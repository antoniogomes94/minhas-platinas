// Tipos compartilhados entre o app (src/) e o crawler (scraper/).

export const PLATFORMS = ['PS5', 'PS4', 'PS3', 'PSVita'] as const
export type Platform = (typeof PLATFORMS)[number]

export const SOURCE_SITES = ['powerpyx', 'psnprofiles', 'mypst', 'psxtrophies'] as const
export type SourceSite = (typeof SOURCE_SITES)[number]

export const SITE_LABELS: Record<SourceSite, string> = {
  powerpyx: 'PowerPyx',
  psnprofiles: 'PSNProfiles',
  mypst: 'MyPST',
  psxtrophies: 'PSX Trophies',
}

export const BACKLOG_LIMIT = 10

// ---------- Dados do usuário (localStorage) ----------

export type FetchStatus = 'idle' | 'pending' | 'done' | 'error' | 'timeout'

export interface GameFetch {
  status: FetchStatus
  requestedAt?: string
  /** scrapedAt do JSON antes de pedir a coleta; a coleta terminou quando ele mudar */
  previousScrapedAt?: string | null
  error?: string
}

export interface Game {
  id: string
  slug: string
  name: string
  platform?: Platform
  coverUrl?: string
  /** Links corrigidos manualmente; quando presentes o crawler não faz busca naquele site. */
  sourceUrls?: Partial<Record<SourceSite, string>>
  fetch?: GameFetch
  addedAt: string
}

export interface Profile {
  name: string
  email: string
  psnId: string
}

export interface Settings {
  githubOwner: string
  githubRepo: string
  githubToken?: string
}

export interface PersistedState {
  version: 1
  profile: Profile
  games: Game[]
  /** ids de jogos em ordem de platina, no máximo BACKLOG_LIMIT */
  backlog: string[]
  settings: Settings
}

// ---------- Ficha consolidada (public/data/games/<slug>.json) ----------

export interface Reading<T> {
  site: SourceSite
  value: T
  /** Texto original de onde o valor foi extraído */
  raw?: string
}

/** Valor consolidado + leituras individuais de cada site. `value: null` = não encontrado. */
export interface Field<T> {
  value: T | null
  /** Site que definiu `value`; null quando é uma média de várias fontes */
  site: SourceSite | null
  readings: Reading<T>[]
}

export interface HoursRange {
  min: number
  max: number
}

export type UnobtainableReason = 'servers' | 'delisted' | 'glitched' | 'other'

export interface Unobtainable {
  flag: boolean
  reason: UnobtainableReason | null
  notes: { site: SourceSite; text: string }[]
}

export type TipKind = 'macete' | 'bug' | 'glitch' | 'cheat'

export interface Tip {
  kind: TipKind
  text: string
  site: SourceSite
  url?: string
}

export interface LinkItem {
  site: string
  title: string
  url: string
  lang?: 'pt' | 'en'
}

export interface VideoItem {
  channel: string
  url: string
  title?: string
}

export interface SourceStatus {
  site: SourceSite
  url: string | null
  ok: boolean
  error?: string
}

export interface GameInfo {
  schemaVersion: 1
  slug: string
  name: string
  platform: Platform | null
  scrapedAt: string
  cover: string | null
  developers: Field<string[]>
  publishers: Field<string[]>
  summary: Field<string>
  autopop: Field<boolean>
  /** Escala 0–10 */
  difficulty: Field<number>
  /** Nota da comunidade do PSX Trophies (escala própria do site) */
  communityDifficulty: Field<number>
  timeHours: Field<HoursRange>
  offlineTrophies: Field<number>
  onlineTrophies: Field<number>
  missableTrophies: Field<number>
  glitchedTrophies: Field<number>
  difficultyAffects: Field<boolean>
  playthroughs: Field<number>
  unobtainable: Unobtainable
  tips: Tip[]
  guides: LinkItem[]
  videos: VideoItem[]
  maps: LinkItem[]
  sources: SourceStatus[]
}
