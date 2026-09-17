import * as cheerio from 'cheerio'
import { fetchJson } from '../http'
import {
  classifyTip,
  decodeEntities,
  detectUnobtainable,
  parseAutopop,
  parseCount,
  parseDifficulty,
  parseHours,
  parseYesNo,
  sameName,
  shortSummary,
  splitSentences,
  youtubeIdsFromHtml,
} from '../text'
import { emptyResult, type ScrapeInput, type SourceResult } from '../types'
import type { Tip } from '../../src/types'

const API = 'https://www.powerpyx.com/wp-json/wp/v2/posts'
const MAX_TIPS = 6

export interface WpPost {
  slug: string
  link: string
  title: { rendered: string }
  content?: { rendered: string }
  _embedded?: { 'wp:featuredmedia'?: { source_url?: string }[] }
}

const bySlug = (slug: string) => `${API}?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`

/** Só aceita título exato "<nome> Trophy Guide", para não confundir Elden Ring com Elden Ring Nightreign. */
export function pickSearchResult(posts: WpPost[], name: string): string | null {
  for (const post of posts) {
    const title = decodeEntities(post.title.rendered)
    if (!/trophy guide/i.test(title)) continue
    const base = title.replace(/\s*trophy guide.*$/i, '').replace(/\s*[-–:]\s*$/, '')
    if (sameName(base, name)) return post.slug
  }
  return null
}

export async function findPost(input: ScrapeInput): Promise<WpPost | null> {
  const override = input.urls.powerpyx
  if (override) {
    const slug = new URL(override).pathname.split('/').filter(Boolean).pop()
    if (!slug) return null
    return (await fetchJson<WpPost[]>(bySlug(slug)))[0] ?? null
  }
  for (const candidate of [`${input.slug}-trophy-guide-roadmap`, `${input.slug}-trophy-guide`]) {
    const post = (await fetchJson<WpPost[]>(bySlug(candidate)))[0]
    if (post) return post
  }
  const search = `${API}?search=${encodeURIComponent(`${input.name} trophy guide`)}&per_page=20&_fields=slug,link,title`
  const slug = pickSearchResult(await fetchJson<WpPost[]>(search), input.name)
  return slug ? ((await fetchJson<WpPost[]>(bySlug(slug)))[0] ?? null) : null
}

type Row = { label: string; value: string }

function roadmapRows($: cheerio.CheerioAPI, list: ReturnType<cheerio.CheerioAPI>): Row[] {
  return list
    .children('li')
    .toArray()
    .map((li) => {
      const clone = $(li).clone()
      clone.find('ul,ol').remove()
      const label = clone.find('b,strong').first().text().replace(/\s+/g, ' ').trim()
      const full = clone.text().replace(/\s+/g, ' ').trim()
      const value = full.slice(full.indexOf(label) + label.length).replace(/^\s*[:?]*\s*:?\s*/, '')
      return { label: label.replace(/[:\s]+$/, ''), value }
    })
    .filter((r) => r.label)
}

export function parsePost(post: WpPost): SourceResult {
  const result = emptyResult('powerpyx', post.link)
  const html = post.content?.rendered ?? ''
  const $ = cheerio.load(html)
  const title = decodeEntities(post.title.rendered)

  // A página tem dois <h2>: "X Trophy Roadmap" e "X Trophy Guide". O roadmap fica antes do segundo.
  const nodes = $('body').children().toArray()
  const secondH2 = nodes.findIndex((n, i) => i > 0 && n.tagName === 'h2')
  const roadmap = secondH2 > 0 ? nodes.slice(0, secondH2) : nodes

  const firstList = roadmap.find((n) => n.tagName === 'ul')
  const rows = firstList ? roadmapRows($, $(firstList)) : []
  const tips: Tip[] = []

  for (const { label, value } of rows) {
    const l = label.toLowerCase()
    if (/difficulty/.test(l) && /estimated|rating/.test(l)) {
      const v = parseDifficulty(value)
      if (v !== null) result.fields.difficulty = { value: v, raw: value }
    } else if (/time to platinum|amount of time/.test(l)) {
      const v = parseHours(value)
      if (v) result.fields.timeHours = { value: v, raw: value }
    } else if (/^offline trophies/.test(l)) {
      const v = parseCount(value)
      if (v !== null) result.fields.offlineTrophies = { value: v, raw: value }
    } else if (/^online trophies/.test(l)) {
      const v = parseCount(value)
      if (v !== null) result.fields.onlineTrophies = { value: v, raw: value }
    } else if (/missable/.test(l)) {
      const v = parseCount(value)
      if (v !== null) result.fields.missableTrophies = { value: v, raw: value }
    } else if (/glitched/.test(l)) {
      const v = parseCount(value)
      if (v !== null) result.fields.glitchedTrophies = { value: v, raw: value }
      if (v !== 0) tips.push({ kind: 'bug', text: `Troféus bugados: ${value}`, site: 'powerpyx', url: post.link })
    } else if (/does difficulty affect/.test(l)) {
      const v = parseYesNo(value)
      if (v !== null) result.fields.difficultyAffects = { value: v, raw: value }
    } else if (/playthrough/.test(l)) {
      const v = parseCount(value)
      if (v !== null) result.fields.playthroughs = { value: v, raw: value }
    } else if (/autopop/.test(l)) {
      const v = parseAutopop(value)
      if (v !== null) result.fields.autopop = { value: v, raw: value }
    } else if (/cheat/.test(l)) {
      tips.push({ kind: 'cheat', text: `${label}: ${value}`, site: 'powerpyx', url: post.link })
    }
  }

  const roadmapText = roadmap.map((n) => $(n).text()).join('\n')
  const unobtainable = detectUnobtainable(roadmapText)
  if (unobtainable) result.unobtainable = unobtainable

  // Resumo: parágrafo depois de "Introduction", sem as frases de boas-vindas.
  const introIndex = roadmap.findIndex((n) => /^h[2-4]$/.test(n.tagName) && /introduction/i.test($(n).text()))
  const intro = roadmap.slice(introIndex + 1).find((n) => n.tagName === 'p')
  if (introIndex >= 0 && intro) {
    const sentences = splitSentences($(intro).text().replace(/\s+/g, ' ')).filter(
      (s) => !/^welcome to\b/i.test(s) && !/^this trophy guide (is|also)/i.test(s),
    )
    const summary = shortSummary(sentences.join(' '))
    if (summary) result.fields.summary = { value: summary, raw: undefined }
  }

  // Dicas: frases dos passos do roadmap (não da lista inicial nem do guia troféu a troféu).
  const seen = new Set(tips.map((t) => t.text))
  for (const node of roadmap) {
    if (node === firstList || !['p', 'ul', 'ol'].includes(node.tagName)) continue
    for (const sentence of splitSentences($(node).text().replace(/\s+/g, ' '))) {
      if (tips.length >= MAX_TIPS) break
      if (sentence.length < 40 || sentence.length > 350 || seen.has(sentence)) continue
      const kind = classifyTip(sentence)
      if (!kind) continue
      seen.add(sentence)
      tips.push({ kind, text: sentence, site: 'powerpyx', url: post.link })
    }
  }
  result.tips = tips

  result.cover = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || undefined
  result.guides = [{ site: 'PowerPyx', title, url: post.link, lang: 'en' }]
  result.videoIds = youtubeIdsFromHtml(html)
  result.ok = true
  return result
}

export async function scrapePowerPyx(input: ScrapeInput): Promise<SourceResult> {
  const post = await findPost(input)
  if (!post) return { ...emptyResult('powerpyx'), error: 'Guia não encontrado' }
  return parsePost(post)
}
