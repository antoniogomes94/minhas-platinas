import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  BACKLOG_LIMIT,
  type Game,
  type GameFetch,
  type PersistedState,
  type Platform,
  type Profile,
  type Settings,
  type SourceSite,
} from '../types'
import { slugify } from '../lib/slug'

// Todas as páginas de usuario.github.io compartilham a mesma origem, por isso o prefixo.
export const STORAGE_KEY = 'minhas-platinas:v1'

export type AddGameResult = { ok: true; game: Game } | { ok: false; error: string }

interface Actions {
  setProfile: (profile: Profile) => void
  setSettings: (settings: Settings) => void
  addGame: (name: string, platform?: Platform) => AddGameResult
  updateGame: (id: string, patch: Partial<Omit<Game, 'id' | 'slug' | 'addedAt'>>) => void
  setSourceUrls: (id: string, urls: Partial<Record<SourceSite, string>>) => void
  setFetch: (id: string, fetch: GameFetch) => void
  removeGame: (id: string) => void
  addToBacklog: (id: string) => boolean
  removeFromBacklog: (id: string) => void
  moveInBacklog: (fromIndex: number, toIndex: number) => void
  replaceAll: (state: PersistedState) => void
}

export type AppStore = PersistedState & Actions

/** Em usuario.github.io/<repo>/ já dá para saber o usuário e o repositório. */
function detectGithubRepo(): Pick<Settings, 'githubOwner' | 'githubRepo'> {
  const fallback = { githubOwner: '', githubRepo: 'minhas-platinas' }
  if (typeof location === 'undefined') return fallback
  const owner = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i)?.[1]
  if (!owner) return fallback
  const firstSegment = location.pathname.split('/').filter(Boolean)[0]
  return { githubOwner: owner, githubRepo: firstSegment ?? `${owner}.github.io` }
}

export const initialState = (): PersistedState => ({
  version: 1,
  profile: { name: '', email: '', psnId: '' },
  games: [],
  backlog: [],
  settings: detectGithubRepo(),
})

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setProfile: (profile) => set({ profile }),

      setSettings: (settings) => set({ settings }),

      addGame: (rawName, platform) => {
        const name = rawName.trim()
        const slug = slugify(name)
        if (!slug) return { ok: false, error: 'Informe o nome do jogo.' }
        const existing = get().games.find((g) => g.slug === slug)
        if (existing) return { ok: false, error: `"${existing.name}" já está na lista.` }
        const game: Game = {
          id: newId(),
          slug,
          name,
          platform,
          fetch: { status: 'idle' },
          addedAt: new Date().toISOString(),
        }
        set((s) => ({ games: [game, ...s.games] }))
        return { ok: true, game }
      },

      updateGame: (id, patch) =>
        set((s) => ({ games: s.games.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      setSourceUrls: (id, urls) => {
        const cleaned = Object.fromEntries(
          Object.entries(urls).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
        ) as Partial<Record<SourceSite, string>>
        get().updateGame(id, { sourceUrls: cleaned })
      },

      setFetch: (id, fetch) => get().updateGame(id, { fetch }),

      removeGame: (id) =>
        set((s) => ({
          games: s.games.filter((g) => g.id !== id),
          backlog: s.backlog.filter((b) => b !== id),
        })),

      addToBacklog: (id) => {
        const { backlog, games } = get()
        if (backlog.includes(id)) return true
        if (backlog.length >= BACKLOG_LIMIT) return false
        if (!games.some((g) => g.id === id)) return false
        set({ backlog: [...backlog, id] })
        return true
      },

      // O jogo continua na lista de desejos.
      removeFromBacklog: (id) => set((s) => ({ backlog: s.backlog.filter((b) => b !== id) })),

      moveInBacklog: (fromIndex, toIndex) =>
        set((s) => {
          const len = s.backlog.length
          if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= len || toIndex >= len) {
            return s
          }
          const next = [...s.backlog]
          const [item] = next.splice(fromIndex, 1)
          next.splice(toIndex, 0, item)
          return { backlog: next }
        }),

      replaceAll: (state) =>
        set({
          version: 1,
          profile: state.profile,
          games: state.games,
          backlog: state.backlog.filter((id) => state.games.some((g) => g.id === id)).slice(0, BACKLOG_LIMIT),
          settings: state.settings,
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ version, profile, games, backlog, settings }): PersistedState => ({
        version,
        profile,
        games,
        backlog,
        settings,
      }),
    },
  ),
)

export const selectPersisted = (s: AppStore): PersistedState => ({
  version: s.version,
  profile: s.profile,
  games: s.games,
  backlog: s.backlog,
  settings: s.settings,
})
