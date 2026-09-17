import {
  SOURCE_SITES,
  type Field,
  type GameInfo,
  type LinkItem,
  type Reading,
  type SourceSite,
  type Tip,
  type VideoItem,
} from '../src/types'
import type { FieldKey, FieldValue, ScrapeInput, SourceResult } from './types'

const MAX_TIPS = 12

/** Ordem de preferência por campo. 'average' = média das leituras (escala 0–10). */
const PRIORITY: Record<FieldKey, SourceSite[] | 'average'> = {
  developers: ['psxtrophies', 'mypst', 'psnprofiles'],
  publishers: ['psxtrophies', 'mypst', 'psnprofiles'],
  // Resumo em português quando existir.
  summary: ['mypst', 'powerpyx'],
  autopop: ['powerpyx', 'mypst'],
  difficulty: 'average',
  communityDifficulty: ['psxtrophies'],
  timeHours: ['powerpyx', 'mypst', 'psnprofiles'],
  offlineTrophies: ['powerpyx', 'mypst', 'psnprofiles'],
  onlineTrophies: ['powerpyx', 'mypst', 'psnprofiles'],
  missableTrophies: ['powerpyx', 'mypst', 'psnprofiles'],
  glitchedTrophies: ['powerpyx', 'mypst', 'psnprofiles'],
  difficultyAffects: ['powerpyx', 'mypst'],
  playthroughs: ['powerpyx', 'mypst', 'psnprofiles'],
}

function buildField<K extends FieldKey>(key: K, results: SourceResult[]): Field<FieldValue<K>> {
  const readings: Reading<FieldValue<K>>[] = []
  for (const r of results) {
    const f = r.fields[key]
    if (f) readings.push({ site: r.site, value: f.value as FieldValue<K>, ...(f.raw ? { raw: f.raw } : {}) })
  }

  const rule: SourceSite[] | 'average' = PRIORITY[key]
  if (rule === 'average') {
    if (readings.length === 0) return { value: null, site: null, readings }
    if (readings.length === 1) return { value: readings[0]!.value, site: readings[0]!.site, readings }
    const avg = readings.reduce((sum, r) => sum + (r.value as number), 0) / readings.length
    return { value: (Math.round(avg * 10) / 10) as FieldValue<K>, site: null, readings }
  }
  for (const site of rule) {
    const reading = readings.find((r) => r.site === site)
    if (reading) return { value: reading.value, site, readings }
  }
  return { value: null, site: null, readings }
}

const uniqueBy = <T>(items: T[], key: (t: T) => string) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export interface Extras {
  videos: VideoItem[]
  maps: LinkItem[]
  otherGuides: LinkItem[]
}

export function mergeResults(input: ScrapeInput, results: SourceResult[], extras: Extras, now = new Date()): GameInfo {
  const bySite = (site: SourceSite) => results.find((r) => r.site === site)
  const ordered = SOURCE_SITES.map(bySite).filter((r): r is SourceResult => !!r)

  // Wallpaper 16:9 do PowerPyx funciona melhor em banner que o ícone quadrado da PSN.
  const coverSite = (['powerpyx', 'psxtrophies', 'mypst'] as SourceSite[]).find((s) => bySite(s)?.cover)
  const unobtainableNotes = ordered.flatMap((r) => (r.unobtainable ? [{ site: r.site, ...r.unobtainable }] : []))
  const reason =
    unobtainableNotes.find((n) => n.reason === 'servers')?.reason ?? unobtainableNotes[0]?.reason ?? null

  // Guias: ordem PSNProfiles, PowerPyx, MyPST, PSX Trophies, depois "outros".
  const guideOrder: SourceSite[] = ['psnprofiles', 'powerpyx', 'mypst', 'psxtrophies']
  const guides = uniqueBy(
    [...guideOrder.flatMap((s) => bySite(s)?.guides ?? []), ...extras.otherGuides],
    (g) => g.url,
  )

  // Dicas: intercala as fontes para não ficar tudo de um site só.
  const tipLists = ordered.map((r) => r.tips)
  const interleaved: Tip[] = []
  for (let i = 0; tipLists.some((l) => i < l.length); i++) {
    for (const list of tipLists) if (list[i]) interleaved.push(list[i]!)
  }

  return {
    schemaVersion: 1,
    slug: input.slug,
    name: input.name,
    platform: input.platform,
    scrapedAt: now.toISOString(),
    cover: coverSite ? bySite(coverSite)!.cover! : null,
    developers: buildField('developers', ordered),
    publishers: buildField('publishers', ordered),
    summary: buildField('summary', ordered),
    autopop: buildField('autopop', ordered),
    difficulty: buildField('difficulty', ordered),
    communityDifficulty: buildField('communityDifficulty', ordered),
    timeHours: buildField('timeHours', ordered),
    offlineTrophies: buildField('offlineTrophies', ordered),
    onlineTrophies: buildField('onlineTrophies', ordered),
    missableTrophies: buildField('missableTrophies', ordered),
    glitchedTrophies: buildField('glitchedTrophies', ordered),
    difficultyAffects: buildField('difficultyAffects', ordered),
    playthroughs: buildField('playthroughs', ordered),
    unobtainable: {
      flag: unobtainableNotes.length > 0,
      reason,
      notes: unobtainableNotes.map(({ site, text }) => ({ site, text })),
    },
    tips: uniqueBy(interleaved, (t) => t.text).slice(0, MAX_TIPS),
    guides,
    videos: uniqueBy(extras.videos, (v) => v.url),
    maps: extras.maps,
    sources: ordered.map((r) => ({ site: r.site, url: r.url, ok: r.ok, ...(r.error ? { error: r.error } : {}) })),
  }
}
