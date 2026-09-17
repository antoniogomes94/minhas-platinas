import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as powerpyx from './sources/powerpyx'
import * as psx from './sources/psxtrophies'
import * as mypst from './sources/mypst'
import { mergeResults } from './merge'
import { emptyResult } from './types'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const ppxPost = (slug: string) => JSON.parse(fixture(`powerpyx-${slug}-trophy-guide-roadmap.json`))[0] as powerpyx.WpPost

describe('PowerPyx', () => {
  it('lê o roadmap de Ghost of Tsushima', () => {
    const r = powerpyx.parsePost(ppxPost('ghost-of-tsushima'))
    expect(r.ok).toBe(true)
    expect(r.fields.difficulty?.value).toBe(3)
    expect(r.fields.timeHours?.value).toEqual({ min: 40, max: 60 })
    expect(r.fields.offlineTrophies?.value).toBe(52)
    expect(r.fields.onlineTrophies?.value).toBe(0)
    expect(r.fields.missableTrophies?.value).toBe(0)
    expect(r.fields.glitchedTrophies?.value).toBe(0)
    expect(r.fields.difficultyAffects?.value).toBe(false)
    expect(r.fields.playthroughs?.value).toBe(1)
    expect(r.fields.autopop?.value).toBe(true)
    expect(r.fields.summary?.value).toMatch(/^Ghost of Tsushima is a Singleplayer/)
    expect(r.unobtainable).toBeUndefined()
    expect(r.cover).toMatch(/ghost-of-tsushima/)
    expect(r.videoIds.length).toBeGreaterThan(0)
    expect(r.guides[0]).toMatchObject({ site: 'PowerPyx', title: 'Ghost of Tsushima Trophy Guide & Roadmap' })
  })

  it('Elden Ring: faixa de dificuldade, autopop = NO e rótulo com &nbsp;', () => {
    const r = powerpyx.parsePost(ppxPost('elden-ring'))
    expect(r.fields.difficulty?.value).toBe(6.5)
    expect(r.fields.autopop?.value).toBe(false)
    expect(r.fields.onlineTrophies?.value).toBe(0)
    expect(r.fields.missableTrophies?.value).toBe(5)
    expect(r.tips.length).toBeGreaterThan(0)
  })

  it('Anthem: servidores desligados e troféus bugados sem número viram dica', () => {
    const r = powerpyx.parsePost(ppxPost('anthem'))
    expect(r.unobtainable?.reason).toBe('servers')
    expect(r.fields.glitchedTrophies).toBeUndefined()
    expect(r.tips.some((t) => t.kind === 'bug' && t.text.startsWith('Troféus bugados'))).toBe(true)
  })

  it('busca só aceita título exato', () => {
    const posts = JSON.parse(fixture('powerpyx-search-elden-ring.json'))
    expect(powerpyx.pickSearchResult(posts, 'Elden Ring')).toBeNull()
    expect(powerpyx.pickSearchResult(posts, 'Elden Ring Nightreign')).toBe('elden-ring-nightreign-trophy-guide-roadmap')
  })
})

describe('PSX Trophies', () => {
  it('escolhe o card pela plataforma', () => {
    const html = fixture('psxtrophies-search-ghost-of-tsushima.html')
    expect(psx.pickSearchResult(html, 'Ghost of Tsushima', 'PS4')).toMatch(/15120-ghost-of-tsushima$/)
    expect(psx.pickSearchResult(html, 'Ghost of Tsushima', 'PS5')).toMatch(/22859-ghost-of-tsushima$/)
    expect(psx.pickSearchResult(html, 'Ghost of Yotei', null)).toBeNull()
  })

  it('desempata pelo total de troféus', () => {
    const html = fixture('psxtrophies-search-ghost-of-tsushima.html')
    // PS5 tem 77 troféus no card, PS4 tem outro total: sem plataforma, o total decide.
    expect(psx.pickSearchResult(html, 'Ghost of Tsushima', null, 77)).toMatch(/22859/)
  })

  it('lê estúdio, publicadora, dificuldade da comunidade e capa', () => {
    const r = psx.parseGamePage(fixture('psxtrophies-game-22859.html'), 'https://www.psxtrophies.com.br/jogo/22859-ghost-of-tsushima')
    expect(r.fields.developers?.value).toEqual(['Sucker Punch Productions'])
    expect(r.fields.publishers?.value).toEqual(['Sony Interactive Entertainment'])
    expect(r.fields.communityDifficulty?.value).toBe(28.1)
    expect(r.cover).toMatch(/^https:\/\/psnobj\.prod\.dl\.playstation\.net\//)
  })
})

describe('MyPST', () => {
  it('extrai o nome do jogo do título do tópico', () => {
    expect(mypst.guideTitleGame('Returnal - Guia de Troféus')).toBe('Returnal')
    expect(mypst.guideTitleGame('[Finalizado] Syberia The World Before - Guia de troféus')).toBe('Syberia The World Before')
    expect(mypst.guideTitleGame('Kena: Bridge of Spirits - Guia de Troféus (PS5/PS4)')).toBe('Kena: Bridge of Spirits')
    expect(mypst.guideTitleGame('[Exophase] Lista de Troféus - Returnal')).toBeNull()
  })

  it('acha o guia na busca do fórum', () => {
    expect(mypst.pickSearchResult(fixture('mypst-forum-search-returnal.html'), 'Returnal')).toBe(
      'https://forum.mypst.com.br/index.php?/topic/76518-returnal-guia-de-trof%C3%A9us/',
    )
  })

  it('separa rótulos grudados', () => {
    const labels = mypst.extractLabels(
      'Dificuldade Estimada do Jogo: 77.3/100 *Pontos de dificuldade: 1596 *Tempo Aproximado de obtenção dos troféus: 60 a 100 horas (ou mais)Offline: Com exceção',
    )
    expect(labels.get('difficulty')).toBe('77.3/100')
    expect(labels.get('timeHours')).toBe('60 a 100 horas (ou mais)')
    expect(labels.get('offlineTrophies')).toBe('Com exceção')
  })

  it('lê o guia de Returnal', () => {
    const r = mypst.parseGuide(fixture('mypst-topic-returnal.html'), 'https://forum.mypst.com.br/x')
    expect(r.fields.difficulty?.value).toBe(7.7)
    expect(r.fields.timeHours?.value).toEqual({ min: 60, max: 100 })
    expect(r.fields.missableTrophies?.value).toBe(0)
    expect(r.fields.glitchedTrophies?.value).toBe(0)
    expect(r.fields.difficultyAffects?.value).toBe(false)
    expect(r.fields.summary?.value).toMatch(/^Quebre o Ciclo/)
    expect(r.tips.some((t) => t.kind === 'cheat')).toBe(true)
    expect(r.videoIds.length).toBeGreaterThan(0)
  })
})

describe('mergeResults', () => {
  const input = { slug: 'returnal', name: 'Returnal', platform: 'PS5' as const, urls: {} }

  it('média na dificuldade, prioridade nos demais campos e PT-BR no resumo', () => {
    const ppx = { ...emptyResult('powerpyx', 'https://ppx'), ok: true }
    ppx.fields = { difficulty: { value: 8.5 }, timeHours: { value: { min: 50, max: 100 } }, summary: { value: 'EN' } }
    ppx.cover = 'https://ppx/cover.jpg'
    const my = { ...emptyResult('mypst', 'https://mypst'), ok: true }
    my.fields = { difficulty: { value: 7.7 }, timeHours: { value: { min: 60, max: 100 } }, summary: { value: 'PT' } }
    const px = { ...emptyResult('psxtrophies', 'https://psx'), ok: true }
    px.cover = 'https://psn/cover.png'
    px.fields = { developers: { value: ['Housemarque'] } }

    const info = mergeResults(input, [ppx, my, px], { videos: [], maps: [], otherGuides: [] }, new Date('2026-09-17T12:00:00Z'))
    expect(info.difficulty).toMatchObject({ value: 8.1, site: null })
    expect(info.difficulty.readings).toHaveLength(2)
    expect(info.timeHours).toMatchObject({ value: { min: 50, max: 100 }, site: 'powerpyx' })
    expect(info.summary).toMatchObject({ value: 'PT', site: 'mypst' })
    expect(info.developers).toMatchObject({ value: ['Housemarque'], site: 'psxtrophies' })
    expect(info.cover).toBe('https://ppx/cover.jpg')
    expect(info.autopop).toEqual({ value: null, site: null, readings: [] })
    expect(info.scrapedAt).toBe('2026-09-17T12:00:00.000Z')
    expect(info.sources.map((s) => s.site)).toEqual(['powerpyx', 'mypst', 'psxtrophies'])
  })

  it('marca implatinável se qualquer fonte acusar', () => {
    const ppx = { ...emptyResult('powerpyx'), ok: true, unobtainable: { reason: 'servers' as const, text: 'Servers were shut down.' } }
    const info = mergeResults(input, [ppx], { videos: [], maps: [], otherGuides: [] })
    expect(info.unobtainable).toEqual({ flag: true, reason: 'servers', notes: [{ site: 'powerpyx', text: 'Servers were shut down.' }] })
  })
})
