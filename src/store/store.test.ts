// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { initialState, selectPersisted, STORAGE_KEY, useAppStore } from './useAppStore'
import { createBackup, parseBackup } from './backup'
import { slugify } from '../lib/slug'

const store = () => useAppStore.getState()

function addGames(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const r = store().addGame(`Jogo ${i + 1}`)
    if (!r.ok) throw new Error(r.error)
    return r.game
  })
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(initialState())
})

describe('slugify', () => {
  it('normaliza acentos, símbolos e apóstrofos', () => {
    expect(slugify("Marvel's Spider-Man 2™")).toBe('marvels-spider-man-2')
    expect(slugify('  Pokémon: Édição Ouro & Prata ')).toBe('pokemon-edicao-ouro-and-prata')
  })
})

describe('lista de desejos', () => {
  it('adiciona jogo e bloqueia duplicado pelo slug', () => {
    expect(store().addGame('Elden Ring', 'PS5').ok).toBe(true)
    const dup = store().addGame('ELDEN RING')
    expect(dup.ok).toBe(false)
    expect(store().games).toHaveLength(1)
  })

  it('rejeita nome vazio', () => {
    expect(store().addGame('   ').ok).toBe(false)
  })

  it('excluir jogo também o tira do backlog', () => {
    const [a, b] = addGames(2)
    store().addToBacklog(a.id)
    store().addToBacklog(b.id)
    store().removeGame(a.id)
    expect(store().backlog).toEqual([b.id])
  })

  it('persiste no localStorage com a chave prefixada', () => {
    addGames(1)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toContain('Jogo 1')
  })
})

describe('backlog', () => {
  it('limita a 10 jogos', () => {
    const games = addGames(11)
    games.slice(0, 10).forEach((g) => expect(store().addToBacklog(g.id)).toBe(true))
    expect(store().addToBacklog(games[10].id)).toBe(false)
    expect(store().backlog).toHaveLength(10)
  })

  it('não duplica e ignora id inexistente', () => {
    const [a] = addGames(1)
    store().addToBacklog(a.id)
    store().addToBacklog(a.id)
    expect(store().addToBacklog('nao-existe')).toBe(false)
    expect(store().backlog).toEqual([a.id])
  })

  it('remover do backlog mantém o jogo na lista de desejos', () => {
    const [a] = addGames(1)
    store().addToBacklog(a.id)
    store().removeFromBacklog(a.id)
    expect(store().backlog).toEqual([])
    expect(store().games.map((g) => g.id)).toContain(a.id)
  })

  it('reordena', () => {
    const [a, b, c] = addGames(3)
    ;[a, b, c].forEach((g) => store().addToBacklog(g.id))
    store().moveInBacklog(0, 2)
    expect(store().backlog).toEqual([b.id, c.id, a.id])
    store().moveInBacklog(2, 0)
    expect(store().backlog).toEqual([a.id, b.id, c.id])
    store().moveInBacklog(0, 5)
    expect(store().backlog).toEqual([a.id, b.id, c.id])
  })
})

describe('backup', () => {
  it('exporta sem o token por padrão e importa de volta', () => {
    const [a] = addGames(2)
    store().addToBacklog(a.id)
    store().setProfile({ name: 'Antonio', email: 'a@b.com', psnId: 'antonio_psn' })
    store().setSettings({ githubOwner: 'antonio', githubRepo: 'minhas-platinas', githubToken: 'secreto' })

    const text = createBackup(selectPersisted(store()))
    expect(text).not.toContain('secreto')
    expect(createBackup(selectPersisted(store()), true)).toContain('secreto')

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    useAppStore.setState(initialState())
    store().replaceAll(parsed.data)
    expect(store().games).toHaveLength(2)
    expect(store().backlog).toEqual([a.id])
    expect(store().profile.psnId).toBe('antonio_psn')
  })

  it('rejeita JSON inválido, formato errado e backlog órfão', () => {
    expect(parseBackup('{oops').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ foo: 1 })).ok).toBe(false)

    const text = createBackup({ ...initialState(), backlog: ['fantasma'] })
    const r = parseBackup(text)
    expect(r.ok).toBe(false)
  })
})
