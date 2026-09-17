import * as cheerio from 'cheerio'
import { fetchText } from '../http'
import { sameName } from '../text'
import { emptyResult, type ScrapeInput, type SourceResult } from '../types'
import type { Platform } from '../../src/types'

const BASE = 'https://www.psxtrophies.com.br'

export const searchUrl = (name: string) =>
  `${BASE}/jogos?page=1&search=${encodeURIComponent(name)}&includes=PSVITA/PS3/PS4/PS5/PSPC/&psn=true&orderBy=release`

const PLATFORM_CHIP: Record<Platform, string> = { PS5: 'PS5', PS4: 'PS4', PS3: 'PS3', PSVita: 'PSVITA' }

/**
 * Escolhe o card com o mesmo nome. Desempate: plataforma pedida e, se informado, o total de troféus
 * mais próximo do esperado (o site às vezes tem duas listas com o mesmo nome).
 */
export function pickSearchResult(
  html: string,
  name: string,
  platform: Platform | null,
  expectedTotal?: number | null,
): string | null {
  const $ = cheerio.load(html)
  const cards = $('li[class*="game-card"]')
    .toArray()
    .map((li) => {
      const card = $(li)
      const link = card.find('a[href^="/jogo/"]').filter((_, a) => $(a).text().trim() !== '').first()
      return {
        href: link.attr('href'),
        title: link.text().trim(),
        platforms: card
          .find('[class*="PlatformChip"]')
          .map((_, c) => $(c).text().trim().toUpperCase())
          .get(),
        // O último número do card é o total de troféus.
        total: Number(card.find('[class*="trophy-item"] h4').last().text().trim()) || null,
      }
    })
    .filter((c) => c.href && sameName(c.title, name))

  if (cards.length === 0) return null
  const onPlatform = platform ? cards.filter((c) => c.platforms.includes(PLATFORM_CHIP[platform])) : []
  const pool = onPlatform.length ? onPlatform : cards
  if (expectedTotal) {
    const distance = (c: (typeof pool)[number]) => (c.total === null ? Infinity : Math.abs(c.total - expectedTotal))
    pool.sort((a, b) => distance(a) - distance(b))
  }
  return BASE + pool[0]!.href!
}

function rowValue($: cheerio.CheerioAPI, label: string): string | null {
  const span = $('span')
    .filter((_, s) => $(s).text().trim() === label)
    .first()
  const value = span.next().text().trim()
  return value || null
}

const splitList = (v: string | null) =>
  v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

export function parseGamePage(html: string, url: string): SourceResult {
  const result = emptyResult('psxtrophies', url)
  const $ = cheerio.load(html)

  const cover = $('meta[property="og:image"]').attr('content')
  if (cover) result.cover = cover

  const developers = splitList(rowValue($, 'Estúdio'))
  if (developers.length) result.fields.developers = { value: developers }
  const publishers = splitList(rowValue($, 'Publicadora'))
  if (publishers.length) result.fields.publishers = { value: publishers }

  // Nota de dificuldade da comunidade: <span>Dificuldade</span> seguido do anel de progresso com o número.
  const diffLabel = $('span')
    .filter((_, s) => $(s).text().trim() === 'Dificuldade')
    .first()
  const diffText = diffLabel.parent().find('[class*="progress-text"]').first().text().trim()
  const diff = Number(diffText.replace(',', '.'))
  if (diffText && Number.isFinite(diff)) result.fields.communityDifficulty = { value: diff, raw: diffText }

  const title = $('title').text().trim()
  result.guides = [{ site: 'PSX Trophies', title: `Lista de troféus${title ? ` — ${title}` : ''} (PT-BR)`, url, lang: 'pt' }]
  result.ok = true
  return result
}

export async function scrapePsxTrophies(input: ScrapeInput, expectedTotal?: number | null): Promise<SourceResult> {
  const url =
    input.urls.psxtrophies ??
    pickSearchResult(await fetchText(searchUrl(input.name)), input.name, input.platform, expectedTotal)
  if (!url) return { ...emptyResult('psxtrophies'), error: 'Jogo não encontrado na busca' }
  return parseGamePage(await fetchText(url), url)
}
