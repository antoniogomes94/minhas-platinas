import { useEffect } from 'react'
import { create } from 'zustand'
import type { GameInfo } from '../types'

export function gameDataUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}data/games/${encodeURIComponent(slug)}.json`
}

/** Retorna null quando o jogo ainda não foi coletado. */
export async function fetchGameInfo(slug: string, bustCache = false): Promise<GameInfo | null> {
  const url = gameDataUrl(slug) + (bustCache ? `?t=${Date.now()}` : '')
  const res = await fetch(url, { cache: bustCache ? 'no-store' : 'default' })
  if (!res.ok) return null
  // O servidor do Vite devolve index.html para arquivos inexistentes.
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) return null
  try {
    const data = (await res.json()) as GameInfo
    return data && data.schemaVersion === 1 ? data : null
  } catch {
    return null
  }
}

interface GameInfoStore {
  /** undefined = não carregado ainda; null = sem dados */
  infos: Record<string, GameInfo | null | undefined>
  loading: Record<string, boolean>
  load: (slug: string, force?: boolean) => Promise<GameInfo | null>
  set: (slug: string, info: GameInfo | null) => void
}

export const useGameInfoStore = create<GameInfoStore>()((set, get) => ({
  infos: {},
  loading: {},
  load: async (slug, force = false) => {
    const { infos, loading } = get()
    if (!force && (infos[slug] !== undefined || loading[slug])) return infos[slug] ?? null
    set((s) => ({ loading: { ...s.loading, [slug]: true } }))
    let info: GameInfo | null = null
    try {
      info = await fetchGameInfo(slug, force)
    } finally {
      set((s) => ({ infos: { ...s.infos, [slug]: info }, loading: { ...s.loading, [slug]: false } }))
    }
    return info
  },
  set: (slug, info) => set((s) => ({ infos: { ...s.infos, [slug]: info } })),
}))

export function useGameInfo(slug: string | undefined) {
  const info = useGameInfoStore((s) => (slug ? s.infos[slug] : undefined))
  const loading = useGameInfoStore((s) => (slug ? !!s.loading[slug] : false))
  const load = useGameInfoStore((s) => s.load)
  useEffect(() => {
    if (slug) void load(slug)
  }, [slug, load])
  return { info: info ?? null, loaded: info !== undefined, loading }
}
