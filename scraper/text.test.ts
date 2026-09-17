import { describe, expect, it } from 'vitest'
import {
  classifyTip,
  detectUnobtainable,
  parseAutopop,
  parseCount,
  parseDifficulty,
  parseHours,
  parseYesNo,
  shortSummary,
  youtubeIdsFromHtml,
} from './text'

describe('parseDifficulty', () => {
  it('lê escalas /10 e /100, faixas e texto extra', () => {
    expect(parseDifficulty('3/10')).toBe(3)
    expect(parseDifficulty('6-7/10 (depends on how you play)')).toBe(6.5)
    expect(parseDifficulty('8.5/10 average (some might find it a 7/10)')).toBe(8.5)
    expect(parseDifficulty('77.3/100 *Pontos')).toBe(7.7)
    expect(parseDifficulty('difícil')).toBeNull()
  })
})

describe('parseHours', () => {
  it.each([
    ['40-60 hours (50 average)', { min: 40, max: 60 }],
    ['40 Hours+', { min: 40, max: 40 }],
    ['100 – 150 hours due to grind', { min: 100, max: 150 }],
    ['50h-100h+ (unpredictable)', { min: 50, max: 100 }],
    ['60 a 100 horas (ou mais)', { min: 60, max: 100 }],
    ['15 hours', { min: 15, max: 15 }],
    ['30 minutes', { min: 0.5, max: 0.5 }],
  ])('%s', (raw, expected) => {
    expect(parseHours(raw)).toEqual(expected)
  })

  it('retorna null sem unidade de tempo', () => {
    expect(parseHours('depende')).toBeNull()
  })
})

describe('parseCount', () => {
  it('lê número inicial, somas com barras e palavras de zero', () => {
    expect(parseCount('52 (1, 2, 9, 40)')).toBe(52)
    expect(parseCount('0, game is online-only')).toBe(0)
    expect(parseCount('18 | 5 | 7 | 1')).toBe(31)
    expect(parseCount('Nenhum, é possível fazer todos')).toBe(0)
    expect(parseCount('Não há, desde que esteja online')).toBe(0)
    expect(parseCount('There are reports of collectibles')).toBeNull()
    expect(parseCount('Minimum 100 match wins')).toBeNull()
  })
})

describe('sim/não e autopop', () => {
  it('parseYesNo', () => {
    expect(parseYesNo('No, can do everything on easy.')).toBe(false)
    expect(parseYesNo('Not for the story')).toBe(false)
    expect(parseYesNo('Sim, afeta')).toBe(true)
    expect(parseYesNo('Depende')).toBeNull()
  })

  it('parseAutopop', () => {
    expect(parseAutopop('Save Transfer = YES, Autopop = NO')).toBe(false)
    expect(parseAutopop('Yes, can transfer save to PS5 and it autopops all trophies')).toBe(true)
    expect(parseAutopop("Yes, save transfer, but it doesn't autopop")).toBe(false)
    expect(parseAutopop('No PS4 version available')).toBe(false)
  })
})

describe('detectUnobtainable', () => {
  it('detecta servidores desligados em inglês e português', () => {
    expect(detectUnobtainable('Anthem Trophy Roadmap\nAnthem Servers were shut down on January 12, 2026.')).toEqual({
      reason: 'servers',
      text: 'Anthem Servers were shut down on January 12, 2026.',
    })
    expect(detectUnobtainable('Concord was shut down on September 6th 2024, and is no longer playable.')?.reason).toBe('servers')
    expect(detectUnobtainable('Os servidores foram desligados em 2023.')?.reason).toBe('servers')
    expect(detectUnobtainable('A platina é implatinável desde o patch.')?.reason).toBe('other')
  })

  it('não marca jogos normais', () => {
    expect(detectUnobtainable('Always be connected to PSN while playing this game. The online servers are great.')).toBeNull()
  })
})

describe('classifyTip', () => {
  it('classifica por palavra-chave', () => {
    expect(classifyTip('Use the Infinite Runes Duplication Exploit to level up.')).toBe('glitch')
    expect(classifyTip('Cheats impedem troféus? Não há cheats.')).toBe('cheat')
    expect(classifyTip('There are many game-breaking progression bugs.')).toBe('bug')
    expect(classifyTip('Back up your save before the final boss.')).toBe('macete')
    expect(classifyTip('The story takes 15 hours.')).toBeNull()
  })
})

it('shortSummary corta em frases inteiras', () => {
  const text = 'Primeira frase curta. Segunda frase também curta. ' + 'Terceira frase bem longa '.repeat(30) + '.'
  expect(shortSummary(text, 60)).toBe('Primeira frase curta. Segunda frase também curta.')
})

it('youtubeIdsFromHtml sem duplicados', () => {
  const html =
    '<iframe src="//www.youtube.com/embed/DgizIkHiycY"></iframe><iframe src="https://www.youtube.com/embed/DgizIkHiycY?feature=oembed"></iframe><iframe src="https://www.youtube-nocookie.com/embed/yiY906xMa8E"></iframe>'
  expect(youtubeIdsFromHtml(html)).toEqual(['DgizIkHiycY', 'yiY906xMa8E'])
})

describe('describeError', async () => {
  const { describeError, HttpError } = await import('./http')
  it('mostra a causa da falha de conexão', () => {
    const err = new TypeError('fetch failed', { cause: Object.assign(new Error('connect'), { code: 'ECONNRESET' }) })
    expect(describeError(err)).toBe('Falha de conexão (ECONNRESET)')
    expect(describeError(new HttpError(403, 'https://x'))).toBe('HTTP 403 em https://x')
    expect(describeError(new DOMException('t', 'TimeoutError'))).toBe('Tempo esgotado ao acessar o site')
  })
})
