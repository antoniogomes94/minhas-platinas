import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogFromSuggestion, fetchCatalog, mapPlatforms, resizeImage, searchGames, toCatalog, toSuggestion, type RawgGame } from './rawg'

const IMAGE = 'https://media.rawg.io/media/games/f24/f2493ea338fe7bd3c7d73750a85a0959.jpeg'

const platform = (slug: string, name = slug) => ({ platform: { id: 0, slug, name } })

const ghost: RawgGame = {
  id: 58550,
  slug: 'ghost-of-tsushima',
  name: 'Ghost of Tsushima',
  released: '2020-07-17',
  background_image: IMAGE,
  metacritic: 83,
  platforms: [platform('playstation4', 'PlayStation 4'), platform('pc', 'PC'), platform('playstation5', 'PlayStation 5')],
  genres: [{ id: 4, slug: 'action', name: 'Action' }],
  developers: [{ id: 1, slug: 'sucker-punch', name: 'Sucker Punch Productions' }],
  publishers: [{ id: 2, slug: 'sie', name: 'Sony Interactive Entertainment' }],
  website: 'https://www.suckerpunch.com/',
}

afterEach(() => vi.unstubAllGlobals())

describe('mapeamento do RAWG', () => {
  it('mantém só PS5, PS4, PS3 e Vita, do mais novo para o mais antigo', () => {
    expect(mapPlatforms([platform('ps-vita'), platform('playstation3'), platform('xbox-one'), platform('playstation5')])).toEqual([
      'PS5',
      'PS3',
      'PSVita',
    ])
    expect(mapPlatforms(null)).toEqual([])
  })

  it('redimensiona imagens pelo caminho do CDN', () => {
    expect(resizeImage(IMAGE, 420)).toBe('https://media.rawg.io/media/resize/420/-/games/f24/f2493ea338fe7bd3c7d73750a85a0959.jpeg')
    expect(resizeImage('https://media.rawg.io/media/resize/1280/-/games/a/b.jpg', 420)).toBe(
      'https://media.rawg.io/media/resize/420/-/games/a/b.jpg',
    )
    expect(resizeImage(null, 420)).toBeNull()
  })

  it('converte busca e detalhes', () => {
    const s = toSuggestion(ghost)
    expect(s).toMatchObject({ name: 'Ghost of Tsushima', year: 2020, platforms: ['PS5', 'PS4'], metacritic: 83 })
    expect(s.thumb).toContain('/resize/420/')

    const c = toCatalog(ghost)
    expect(c).toMatchObject({
      source: 'rawg',
      developers: ['Sucker Punch Productions'],
      publishers: ['Sony Interactive Entertainment'],
      genres: ['Action'],
      platforms: ['PS5', 'PS4'],
      website: 'https://www.suckerpunch.com/',
    })
    expect(c.image).toContain('/resize/1280/')
    expect(catalogFromSuggestion(s)).toMatchObject({ developers: [], publishers: [], platforms: ['PS5', 'PS4'] })
  })

  it('tolera campos ausentes', () => {
    const c = toCatalog({ id: 1, slug: 'x', name: 'X' })
    expect(c).toMatchObject({ released: null, image: null, developers: [], platforms: [], metacritic: null, website: null })
  })
})

describe('chamadas à API', () => {
  it('busca só PlayStation, sem DLC, e usa cache', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: [ghost] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const first = await searchGames('minha-chave', 'Ghost of Tsu')
    await searchGames('minha-chave', 'ghost of tsu ')
    expect(first[0]?.name).toBe('Ghost of Tsushima')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await searchGames('outra-chave', 'Ghost of Tsu')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]))
    expect(url.pathname).toBe('/api/games')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      key: 'minha-chave',
      search: 'Ghost of Tsu',
      parent_platforms: '2',
      exclude_additions: 'true',
    })
  })

  it('traduz erros de chave e limite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(fetchCatalog('ruim', 1)).rejects.toThrow('Chave do RAWG inválida')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    await expect(fetchCatalog('ok', 1)).rejects.toThrow('Limite de buscas')
    // chave inválida no navegador: resposta sem CORS vira TypeError
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(fetchCatalog('ruim', 1)).rejects.toThrow('Confira a chave no Perfil')
  })
})
