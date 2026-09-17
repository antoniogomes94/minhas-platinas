import type { Field, GameInfo, LinkItem, Platform, SourceSite, Tip, UnobtainableReason } from '../src/types'

export type FieldKey = {
  [K in keyof GameInfo]: GameInfo[K] extends Field<unknown> ? K : never
}[keyof GameInfo]

export type FieldValue<K extends FieldKey> = GameInfo[K] extends Field<infer T> ? T : never

export type SourceFields = { [K in FieldKey]?: { value: FieldValue<K>; raw?: string } }

/** O que cada site conseguiu extrair. */
export interface SourceResult {
  site: SourceSite
  url: string | null
  ok: boolean
  error?: string
  cover?: string
  fields: SourceFields
  unobtainable?: { reason: UnobtainableReason; text: string }
  tips: Tip[]
  guides: LinkItem[]
  /** ids de vídeos do YouTube embutidos na página */
  videoIds: string[]
}

export interface ScrapeInput {
  slug: string
  name: string
  platform: Platform | null
  urls: Partial<Record<SourceSite, string>>
}

export const emptyResult = (site: SourceSite, url: string | null = null): SourceResult => ({
  site,
  url,
  ok: false,
  fields: {},
  tips: [],
  guides: [],
  videoIds: [],
})
