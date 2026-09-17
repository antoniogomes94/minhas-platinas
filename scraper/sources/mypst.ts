import * as cheerio from 'cheerio'
import { fetchText } from '../http'
import {
  classifyTip,
  detectUnobtainable,
  parseAutopop,
  parseCount,
  parseDifficulty,
  parseHours,
  parseYesNo,
  sameName,
  shortSummary,
  splitSentences,
  textLines,
  youtubeIdsFromHtml,
} from '../text'
import { emptyResult, type FieldKey, type ScrapeInput, type SourceResult } from '../types'
import type { Tip } from '../../src/types'

const FORUM = 'https://forum.mypst.com.br/index.php'
const MAX_TIPS = 6

export const searchUrl = (name: string) =>
  `${FORUM}?/search/&q=${encodeURIComponent(name)}&type=forums_topic&search_in=titles`

/** "[Finalizado] Kena: Bridge of Spirits - Guia de Troféus (PS5/PS4)" -> "Kena: Bridge of Spirits" */
export function guideTitleGame(title: string): string | null {
  const clean = title.replace(/^(\s*\[[^\]]*\]\s*)+/, '').trim()
  const m = clean.match(/^(.*?)\s*[-–|:]\s*guia de trof[eé]us\b/i)
  return m ? m[1]!.trim() : null
}

export function pickSearchResult(html: string, name: string): string | null {
  const $ = cheerio.load(html)
  for (const a of $('.ipsStreamItem_title a').toArray()) {
    const game = guideTitleGame($(a).text().trim())
    const href = $(a).attr('href')
    if (game && href && sameName(game, name)) return href.replace(/&do=findComment.*$/, '')
  }
  return null
}

type Extra = 'cheats' | 'points'
const LABELS: { key: FieldKey | Extra; re: RegExp }[] = [
  { key: 'difficulty', re: /dificuldade estimada(?: do jogo)?\s*:/i },
  { key: 'points', re: /pontos de dificuldade\s*:/i },
  { key: 'timeHours', re: /tempo (?:aproximado|estimado)[^:\n]{0,60}:/i },
  { key: 'offlineTrophies', re: /(?:trof[eé]us |jogo base )?offline\s*:/i },
  { key: 'onlineTrophies', re: /(?:trof[eé]us |jogo base )?online\s*:/i },
  { key: 'missableTrophies', re: /trof[eé]us (?:que (?:voc[eê] )?pode perder|perd[ií]veis)\s*:/i },
  { key: 'playthroughs', re: /(?:n[uú]mero )?m[ií]nimo de jogadas\s*:/i },
  { key: 'difficultyAffects', re: /a dificuldade afeta (?:os )?trof[eé]us\??\s*:/i },
  { key: 'glitchedTrophies', re: /trof[eé]us bugados\s*:/i },
  { key: 'cheats', re: /cheats? impede[m]? (?:os )?trof[eé]us\??\s*:/i },
  { key: 'autopop', re: /auto-?pop[^:\n]{0,40}:/i },
]

/** Divide o texto em pares rótulo → valor, mesmo quando os rótulos vêm grudados na mesma linha. */
export function extractLabels(text: string): Map<FieldKey | Extra, string> {
  const hits: { key: FieldKey | Extra; start: number; end: number }[] = []
  for (const { key, re } of LABELS) {
    const m = re.exec(text)
    if (m) hits.push({ key, start: m.index, end: m.index + m[0].length })
  }
  hits.sort((a, b) => a.start - b.start)
  const out = new Map<FieldKey | Extra, string>()
  hits.forEach((hit, i) => {
    const next = hits[i + 1]?.start ?? text.length
    const value = text
      .slice(hit.end, next)
      .split('\n')[0]!
      .replace(/^\s*\*?\s*/, '')
      .replace(/\s*\*\s*$/, '')
      .trim()
    if (value) out.set(hit.key, value)
  })
  return out
}

export function parseGuide(html: string, url: string): SourceResult {
  const result = emptyResult('mypst', url)
  const $ = cheerio.load(html)
  const post = $('[data-role="commentContent"]').first().length ? $('[data-role="commentContent"]').first() : $('article').first()
  const lines = textLines($, post)
  const text = lines.join('\n')
  const labels = extractLabels(text)
  const tips: Tip[] = []

  const set = <K extends FieldKey>(key: K, value: unknown, raw: string) => {
    if (value !== null) (result.fields as Record<string, unknown>)[key] = { value, raw }
  }
  for (const [key, raw] of labels) {
    switch (key) {
      case 'difficulty':
        set(key, parseDifficulty(raw), raw)
        break
      case 'timeHours':
        set(key, parseHours(raw), raw)
        break
      case 'offlineTrophies':
      case 'onlineTrophies':
      case 'missableTrophies':
      case 'playthroughs':
        set(key, parseCount(raw), raw)
        break
      case 'glitchedTrophies': {
        const v = parseCount(raw)
        set(key, v, raw)
        if (v !== 0) tips.push({ kind: 'bug', text: `Troféus bugados: ${raw}`, site: 'mypst', url })
        break
      }
      case 'difficultyAffects':
        set(key, parseYesNo(raw), raw)
        break
      case 'autopop':
        set(key, parseAutopop(raw), raw)
        break
      case 'cheats':
        tips.push({ kind: 'cheat', text: `Cheats impedem troféus? ${raw}`, site: 'mypst', url })
        break
    }
  }

  // Resumo: primeira linha longa que não seja um rótulo (normalmente a opinião do autor ou a introdução).
  const intro = lines.find((l) => l.length > 120 && !LABELS.some(({ re }) => re.test(l)))
  if (intro) set('summary', shortSummary(intro.replace(/^["“]|["”]$/g, '')), intro.slice(0, 200))

  const unobtainable = detectUnobtainable(lines.slice(0, 60).join('\n'))
  if (unobtainable) result.unobtainable = unobtainable

  const seen = new Set(tips.map((t) => t.text))
  for (const line of lines) {
    if (tips.length >= MAX_TIPS) break
    if (line === intro || LABELS.some(({ re }) => re.test(line))) continue
    for (const sentence of splitSentences(line)) {
      if (tips.length >= MAX_TIPS) break
      if (sentence.length < 40 || sentence.length > 350 || sentence.endsWith('?') || seen.has(sentence)) continue
      const kind = classifyTip(sentence)
      if (!kind) continue
      seen.add(sentence)
      tips.push({ kind, text: sentence, site: 'mypst', url })
    }
  }
  result.tips = tips

  const cover = $('meta[property="og:image"]').attr('content')
  if (cover) result.cover = cover
  const title = $('title').text().split(' - ').slice(0, 2).join(' - ').trim()
  result.guides = [{ site: 'MyPST', title: title || 'Guia de Troféus', url, lang: 'pt' }]
  result.videoIds = youtubeIdsFromHtml($.html(post))
  result.ok = true
  return result
}

export async function scrapeMypst(input: ScrapeInput): Promise<SourceResult> {
  const url = input.urls.mypst ?? pickSearchResult(await fetchText(searchUrl(input.name)), input.name)
  if (!url) return { ...emptyResult('mypst'), error: 'Nenhum "Guia de Troféus" no fórum' }
  return parseGuide(await fetchText(url), url)
}
