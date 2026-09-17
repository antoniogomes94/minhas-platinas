import { PLATFORMS, type CatalogInfo, type Platform } from '../types'

const API = 'https://api.rawg.io/api'
export const RAWG_URL = 'https://rawg.io'
export const RAWG_KEY_URL = 'https://rawg.io/apidocs'
const PLAYSTATION_PARENT_ID = 2

interface RawgNamed {
  id: number
  name: string
  slug: string
}

interface RawgPlatformRef {
  platform: RawgNamed
}

export interface RawgGame {
  id: number
  slug: string
  name: string
  released?: string | null
  background_image?: string | null
  metacritic?: number | null
  platforms?: RawgPlatformRef[] | null
  genres?: RawgNamed[] | null
  developers?: RawgNamed[] | null
  publishers?: RawgNamed[] | null
  website?: string | null
}

export interface Suggestion {
  id: number
  slug: string
  name: string
  released: string | null
  year: number | null
  thumb: string | null
  image: string | null
  platforms: Platform[]
  genres: string[]
  metacritic: number | null
}

const PLATFORM_BY_SLUG: Record<string, Platform> = {
  playstation5: 'PS5',
  playstation4: 'PS4',
  playstation3: 'PS3',
  'ps-vita': 'PSVita',
}

/** Só as plataformas que o app usa, da mais nova para a mais antiga. */
export function mapPlatforms(refs: RawgPlatformRef[] | null | undefined): Platform[] {
  const found = new Set((refs ?? []).map((r) => PLATFORM_BY_SLUG[r.platform.slug]).filter(Boolean))
  return PLATFORMS.filter((p) => found.has(p))
}

/** A imagem original do RAWG chega a 4 MB; o CDN deles redimensiona pelo caminho. */
export function resizeImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null
  if (/\/media\/resize\/\d+\/-\//.test(url)) return url.replace(/\/media\/resize\/\d+\/-\//, `/media/resize/${width}/-/`)
  return url.replace(/\/media\/(games|screenshots)\//, `/media/resize/${width}/-/$1/`)
}

const yearOf = (released: string | null | undefined) => (released ? Number(released.slice(0, 4)) || null : null)
const names = (items: RawgNamed[] | null | undefined) => (items ?? []).map((i) => i.name)

export function toSuggestion(g: RawgGame): Suggestion {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    released: g.released ?? null,
    year: yearOf(g.released),
    thumb: resizeImage(g.background_image, 420),
    image: resizeImage(g.background_image, 1280),
    platforms: mapPlatforms(g.platforms),
    genres: names(g.genres),
    metacritic: g.metacritic ?? null,
  }
}

export function toCatalog(g: RawgGame): CatalogInfo {
  return {
    source: 'rawg',
    id: g.id,
    slug: g.slug,
    name: g.name,
    released: g.released ?? null,
    image: resizeImage(g.background_image, 1280),
    developers: names(g.developers),
    publishers: names(g.publishers),
    genres: names(g.genres),
    platforms: mapPlatforms(g.platforms),
    metacritic: g.metacritic ?? null,
    website: g.website || null,
  }
}

/** Catálogo parcial a partir da sugestão, se os detalhes não carregarem. */
export function catalogFromSuggestion(s: Suggestion): CatalogInfo {
  return {
    source: 'rawg',
    id: s.id,
    slug: s.slug,
    name: s.name,
    released: s.released,
    image: s.image,
    developers: [],
    publishers: [],
    genres: s.genres,
    platforms: s.platforms,
    metacritic: s.metacritic,
    website: null,
  }
}

export const rawgGameUrl = (slug: string) => `${RAWG_URL}/games/${slug}`

async function get<T>(path: string, key: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ key: key.trim(), ...params })
  let res: Response
  try {
    res = await fetch(`${API}${path}?${query}`, { signal })
  } catch (err) {
    if (signal?.aborted) throw err
    // As respostas de erro do RAWG (ex.: 401 de chave inválida) vêm sem CORS, e o navegador só vê "Failed to fetch".
    throw new Error('Não foi possível consultar o RAWG. Confira a chave no Perfil e sua conexão.')
  }
  if (res.ok) return (await res.json()) as T
  if (res.status === 401 || res.status === 403) throw new Error('Chave do RAWG inválida. Confira no Perfil.')
  if (res.status === 429) throw new Error('Limite de buscas do RAWG atingido. Tente mais tarde.')
  throw new Error(`O RAWG respondeu com erro ${res.status}.`)
}

const searchCache = new Map<string, Suggestion[]>()

export async function searchGames(key: string, query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = query.trim()
  const cacheKey = `${key.trim()}|${q.toLowerCase()}`
  const cached = searchCache.get(cacheKey)
  if (cached) return cached
  const data = await get<{ results: RawgGame[] }>(
    '/games',
    key,
    { search: q, parent_platforms: String(PLAYSTATION_PARENT_ID), exclude_additions: 'true', page_size: '8' },
    signal,
  )
  const suggestions = data.results.map(toSuggestion)
  searchCache.set(cacheKey, suggestions)
  return suggestions
}

export async function fetchCatalog(key: string, id: number, signal?: AbortSignal): Promise<CatalogInfo> {
  return toCatalog(await get<RawgGame>(`/games/${id}`, key, {}, signal))
}
