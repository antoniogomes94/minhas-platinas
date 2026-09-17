// Uso: npm run scrape -- --name "Ghost of Tsushima" [--slug ghost-of-tsushima] [--platform PS5] [--urls '{"powerpyx":"https://..."}']
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { slugify } from '../src/lib/slug'
import { PLATFORMS, SITE_LABELS, SOURCE_SITES, type Platform, type SourceSite } from '../src/types'
import { mergeResults } from './merge'
import { scrapeMypst } from './sources/mypst'
import { scrapePowerPyx } from './sources/powerpyx'
import { scrapePsxTrophies } from './sources/psxtrophies'
import { channelVideoLinks, describeVideos, mapLinks, otherGuideLinks, psnProfilesLinks } from './sources/links'
import { describeError } from './http'
import { emptyResult, type ScrapeInput, type SourceResult } from './types'

function fail(message: string): never {
  console.error(`Erro: ${message}`)
  process.exit(2)
}

export function parseInput(argv: string[]): ScrapeInput & { out: string } {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: 'string' },
      slug: { type: 'string' },
      platform: { type: 'string' },
      urls: { type: 'string' },
      out: { type: 'string', default: 'public/data/games' },
    },
  })

  const name = values.name?.trim()
  if (!name) fail('--name é obrigatório')
  if (name.length > 150) fail('--name muito longo')

  const slug = values.slug?.trim() || slugify(name)
  // O slug vira nome de arquivo e vem de input do workflow: só letras minúsculas, números e hífen.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) fail(`slug inválido: "${slug}"`)

  const platform = values.platform?.trim() || null
  if (platform && !PLATFORMS.includes(platform as Platform)) fail(`plataforma inválida: "${platform}"`)

  let urls: Partial<Record<SourceSite, string>> = {}
  if (values.urls?.trim()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(values.urls)
    } catch {
      fail('--urls precisa ser um JSON')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('--urls precisa ser um objeto JSON')
    for (const [site, url] of Object.entries(parsed)) {
      if (!SOURCE_SITES.includes(site as SourceSite)) fail(`site desconhecido em --urls: ${site}`)
      if (typeof url !== 'string' || !/^https:\/\//.test(url)) fail(`URL inválida para ${site}`)
      urls = { ...urls, [site]: url }
    }
  }

  return { name, slug, platform: platform as Platform | null, urls, out: values.out! }
}

async function safely(site: SourceSite, run: () => Promise<SourceResult>): Promise<SourceResult> {
  try {
    return await run()
  } catch (err) {
    return { ...emptyResult(site), error: describeError(err).slice(0, 200) }
  }
}

async function main() {
  const input = parseInput(process.argv.slice(2))
  console.log(`Coletando "${input.name}" (${input.slug}${input.platform ? `, ${input.platform}` : ''})…`)

  // Sites diferentes em paralelo; cada site respeita 1 requisição por segundo.
  // O PSX Trophies espera o PowerPyx para desempatar listas com o mesmo nome pelo total de troféus.
  const [[powerpyx, psx], mypst, maps] = await Promise.all([
    safely('powerpyx', () => scrapePowerPyx(input)).then(async (ppx) => {
      const { offlineTrophies: off, onlineTrophies: on } = ppx.fields
      const total = off || on ? (off?.value ?? 0) + (on?.value ?? 0) : null
      return [ppx, await safely('psxtrophies', () => scrapePsxTrophies(input, total))] as const
    }),
    safely('mypst', () => scrapeMypst(input)),
    mapLinks(input.slug).catch(() => []),
  ])
  const results = [powerpyx, psx, mypst, psnProfilesLinks(input)]

  const embedded = await describeVideos([...powerpyx.videoIds, ...mypst.videoIds])
  const info = mergeResults(input, results, {
    videos: [...embedded, ...channelVideoLinks(input.name)],
    maps,
    otherGuides: otherGuideLinks(input.name),
  })

  for (const r of results) {
    const status = r.ok ? 'ok  ' : 'erro'
    console.log(`  [${status}] ${SITE_LABELS[r.site].padEnd(13)} ${r.url ?? r.error ?? ''}`)
  }
  const filled = Object.entries(info).filter(
    ([, v]) => v && typeof v === 'object' && 'readings' in v && (v as { value: unknown }).value !== null,
  )
  console.log(`  Campos preenchidos: ${filled.map(([k]) => k).join(', ') || 'nenhum'}`)
  console.log(`  Dicas: ${info.tips.length} · Guias: ${info.guides.length} · Vídeos: ${info.videos.length} · Mapas: ${info.maps.length}`)
  if (info.unobtainable.flag) console.log(`  ⚠ ${info.unobtainable.reason}: ${info.unobtainable.notes[0]?.text}`)

  const file = path.join(input.out, `${input.slug}.json`)
  const anyScraped = results.some((r) => r.ok)
  if (!anyScraped && existsSync(file)) {
    console.error('Nenhum site respondeu; mantendo o arquivo anterior.')
    process.exit(1)
  }

  await mkdir(input.out, { recursive: true })
  await writeFile(file, JSON.stringify(info, null, 2) + '\n')
  console.log(`Salvo em ${file}`)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('cli.ts')) {
  void main()
}
