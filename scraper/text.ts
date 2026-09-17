import type { CheerioAPI } from 'cheerio'
import type { HoursRange, TipKind, UnobtainableReason } from '../src/types'
import { slugify } from '../src/lib/slug'

const BLOCK_TAGS = 'p,div,li,ul,ol,h1,h2,h3,h4,h5,h6,tr,table,section,article,blockquote,header,footer'

/** Texto do elemento com quebras de linha nos blocos e <br>, espaços normalizados por linha. */
export function textLines($: CheerioAPI, selector: Parameters<CheerioAPI>[0]): string[] {
  const root = $(selector).clone()
  root.find('script,style,noscript,svg').remove()
  root.find('br').replaceWith('\n')
  root.find(BLOCK_TAGS).each((_, el) => {
    $(el).prepend('\n').append('\n')
  })
  return root
    .text()
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export const sameName = (a: string, b: string) => slugify(a) === slugify(b)

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

const toNumber = (s: string) => Number(s.replace(',', '.'))

/** "6-7/10 (depende...)" -> 6.5 ; "77.3/100" -> 7.7 ; "3/10" -> 3 */
export function parseDifficulty(raw: string): number | null {
  const m = raw.match(/(\d+(?:[.,]\d+)?)(?:\s*[-–a]\s*(\d+(?:[.,]\d+)?))?\s*\/\s*(10|100)\b/)
  if (!m) return null
  const low = toNumber(m[1]!)
  const high = m[2] ? toNumber(m[2]) : low
  const scale = Number(m[3])
  const value = ((low + high) / 2) * (10 / scale)
  if (!Number.isFinite(value) || value < 0 || value > 10) return null
  return Math.round(value * 10) / 10
}

/** "40-60 hours", "40 Hours+", "100 – 150 hours", "50h-100h+", "60 a 100 horas", "30 minutes" */
export function parseHours(raw: string): HoursRange | null {
  const m = raw.match(
    /(\d+(?:[.,]\d+)?)\s*(?:h(?:ours?|rs?)?|horas?)?\s*(?:(?:-|–|—|to|a|~)\s*(\d+(?:[.,]\d+)?))?\s*\+?\s*(hours?|hrs?|h\b|horas?|minutes?|mins?|minutos?)/i,
  )
  if (!m) return null
  const minutes = /^min/i.test(m[3]!)
  const factor = minutes ? 1 / 60 : 1
  const round = (n: number) => Math.round(n * factor * 10) / 10
  const min = round(toNumber(m[1]!))
  const max = m[2] ? round(toNumber(m[2])) : min
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

const ZERO_WORDS = /^(none|no|nothing|nenhum[a]?|não há|nao ha|não|nao|zero)\b/i

/** Número no início do texto. "18 | 5 | 7 | 1" soma os tipos; "Nenhum" = 0. */
export function parseCount(raw: string): number | null {
  const text = raw.trim()
  const pipes = text.match(/^(\d+)(\s*\|\s*\d+)+/)
  if (pipes) return pipes[0].split('|').reduce((sum, n) => sum + Number(n.trim()), 0)
  const m = text.match(/^(\d+)\b/)
  if (m) return Number(m[1])
  if (ZERO_WORDS.test(text)) return 0
  return null
}

export function parseYesNo(raw: string): boolean | null {
  const text = raw.trim()
  if (/^(yes|sim)\b/i.test(text)) return true
  if (/^(no|not|não|nao|nope)\b/i.test(text)) return false
  return null
}

/** PowerPyx: "Save Transfer = YES, Autopop = NO" / "Yes, ... it autopops all trophies" / "No PS4 version" */
export function parseAutopop(raw: string): boolean | null {
  const explicit = raw.match(/auto-?pop\w*\s*[=:]\s*(yes|no|sim|não|nao)/i)
  if (explicit) return /^(yes|sim)/i.test(explicit[1]!)
  if (/\b(no|not|won'?t|doesn'?t|does not|will not|não|nao)\s+(\w+\s+){0,2}auto-?pop/i.test(raw)) return false
  if (/auto-?pop(s|ped)?\b/i.test(raw) && /^(yes|sim)\b/i.test(raw.trim())) return true
  return parseYesNo(raw)
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“(])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Primeiras frases até ~maxChars. */
export function shortSummary(text: string, maxChars = 360): string {
  let out = ''
  for (const s of splitSentences(text)) {
    if (out && out.length + s.length + 1 > maxChars) break
    out = out ? `${out} ${s}` : s
  }
  return out.length > maxChars + 80 ? `${out.slice(0, maxChars).trimEnd()}…` : out
}

const TIP_PATTERNS: [TipKind, RegExp][] = [
  ['glitch', /\b(glitch\w*|exploits?|exploited|duplication|dupe|duplica[çc][ãa]o)\b/i],
  ['cheat', /\b(cheats?|cheat codes?|trapaças?)\b/i],
  ['bug', /\b(bug|bugs|bugged|bugados?|buggy)\b/i],
  ['macete', /\b(cheese|trick|shortcut|save[- ]?scum\w*|back ?up your save|backup save|save backup|cloud save|farm(ing)?|macetes?|truques?|atalho)\b/i],
]

export function classifyTip(sentence: string): TipKind | null {
  for (const [kind, re] of TIP_PATTERNS) if (re.test(sentence)) return kind
  return null
}

const UNOBTAINABLE_PATTERNS: [UnobtainableReason, RegExp][] = [
  [
    'servers',
    /\b(servers?\s+(were|was|have been|has been|are|will be|went)\s+(permanently\s+)?(shut ?down|shutdown|offline|closed|turned off|decommissioned)|(was|were|has been|have been)\s+shut down on|servidor(es)?\s+(foram|foi|estão|serão|será)\s+(desligados?|encerrados?|fechados?|desativados?))/i,
  ],
  [
    'other',
    /\b(platinum (is|will be) (now )?unobtainable|unobtainable (platinum|trophies)|platina (é |está |ficou )?(impossível|imposs[ií]vel de obter)|implatin[aá]vel)\b/i,
  ],
]

export function detectUnobtainable(text: string): { reason: UnobtainableReason; text: string } | null {
  const sentences = text.split(/\n+/).flatMap((line) => splitSentences(line.replace(/\s+/g, ' ').trim()))
  for (const sentence of sentences) {
    for (const [reason, re] of UNOBTAINABLE_PATTERNS) {
      if (re.test(sentence)) return { reason, text: sentence.slice(0, 300) }
    }
  }
  return null
}

export function youtubeIdsFromHtml(html: string): string[] {
  const ids = [...html.matchAll(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/g)].map((m) => m[1]!)
  return [...new Set(ids)]
}
