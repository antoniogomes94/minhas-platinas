import { CHANNELS } from '../../src/config/channels'
import { request, urlExists } from '../http'
import { emptyResult, type ScrapeInput, type SourceResult } from '../types'
import type { LinkItem, VideoItem } from '../../src/types'

const q = encodeURIComponent

/** PSNProfiles bloqueia robôs com Cloudflare (testado com fetch e Chromium headless), então só gera links. */
export function psnProfilesLinks(input: ScrapeInput): SourceResult {
  const result = emptyResult('psnprofiles', input.urls.psnprofiles ?? null)
  result.error = 'Bloqueia coleta automática (Cloudflare). Use os links.'
  const guides: LinkItem[] = []
  if (input.urls.psnprofiles) guides.push({ site: 'PSNProfiles', title: 'Página indicada por você', url: input.urls.psnprofiles, lang: 'en' })
  guides.push(
    { site: 'PSNProfiles', title: 'Buscar lista de troféus', url: `https://psnprofiles.com/search/games?q=${q(input.name)}`, lang: 'en' },
    { site: 'PSNProfiles', title: 'Buscar guias', url: `https://psnprofiles.com/search/guides?q=${q(input.name)}`, lang: 'en' },
  )
  result.guides = guides
  return result
}

export function otherGuideLinks(name: string): LinkItem[] {
  return [
    { site: 'PlayStationTrophies', title: 'Buscar guia', url: `https://www.playstationtrophies.org/search/?q=${q(name)}`, lang: 'en' },
    { site: 'TrueTrophies', title: 'Buscar guia', url: `https://www.truetrophies.com/searchresults.aspx?search=${q(name)}`, lang: 'en' },
    { site: 'Reddit r/Trophies', title: 'Discussões', url: `https://www.reddit.com/r/Trophies/search/?q=${q(name)}&restrict_sr=1`, lang: 'en' },
  ]
}

export function channelVideoLinks(name: string): VideoItem[] {
  return [
    ...CHANNELS.map((c) => ({
      channel: c.name,
      url: `https://www.youtube.com/@${c.handle}/search?query=${q(name)}`,
      title: 'Buscar no canal',
    })),
    {
      channel: 'YouTube (PT-BR)',
      url: `https://www.youtube.com/results?search_query=${q(`${name} guia de troféus platina`)}`,
      title: 'Buscar "guia de troféus"',
    },
    {
      channel: 'YouTube (EN)',
      url: `https://www.youtube.com/results?search_query=${q(`${name} trophy guide`)}`,
      title: 'Buscar "trophy guide"',
    },
  ]
}

interface OEmbed {
  title?: string
  author_name?: string
}

/** Título e canal de vídeos embutidos, via oEmbed (não precisa de chave de API). */
export async function describeVideos(ids: string[], limit = 8): Promise<VideoItem[]> {
  const videos: VideoItem[] = []
  for (const id of ids.slice(0, limit)) {
    const url = `https://www.youtube.com/watch?v=${id}`
    try {
      const res = await request(`https://www.youtube.com/oembed?url=${q(url)}&format=json`, {}, 0)
      if (!res.ok) continue
      const data = (await res.json()) as OEmbed
      videos.push({ channel: data.author_name ?? 'YouTube', url, title: data.title })
    } catch {
      // vídeo removido ou privado
    }
  }
  return videos
}

export async function mapLinks(slug: string): Promise<LinkItem[]> {
  const url = `https://mapgenie.io/${slug}`
  return (await urlExists(url)) ? [{ site: 'Map Genie', title: 'Mapas interativos', url }] : []
}
