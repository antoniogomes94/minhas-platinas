import { z } from 'zod'
import { BACKLOG_LIMIT, PLATFORMS, SOURCE_SITES, type PersistedState } from '../types'

const BACKUP_APP = 'minhas-platinas'

const gameSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  platform: z.enum(PLATFORMS).optional(),
  catalog: z
    .object({
      source: z.literal('rawg'),
      id: z.number(),
      slug: z.string(),
      name: z.string(),
      released: z.string().nullable(),
      image: z.string().nullable(),
      developers: z.array(z.string()),
      publishers: z.array(z.string()),
      genres: z.array(z.string()),
      platforms: z.array(z.enum(PLATFORMS)),
      metacritic: z.number().nullable(),
      website: z.string().nullable(),
    })
    .optional(),
  coverUrl: z.string().optional(),
  sourceUrls: z.partialRecord(z.enum(SOURCE_SITES), z.string()).optional(),
  fetch: z
    .object({
      status: z.enum(['idle', 'pending', 'done', 'error', 'timeout']),
      requestedAt: z.string().optional(),
      previousScrapedAt: z.string().nullable().optional(),
      error: z.string().optional(),
    })
    .optional(),
  addedAt: z.string(),
})

const stateSchema = z.object({
  version: z.literal(1),
  profile: z.object({ name: z.string(), email: z.string(), psnId: z.string() }),
  games: z.array(gameSchema),
  backlog: z.array(z.string()).max(BACKLOG_LIMIT),
  settings: z.object({
    githubOwner: z.string(),
    githubRepo: z.string(),
    githubToken: z.string().optional(),
    rawgKey: z.string().optional(),
  }),
})

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  exportedAt: z.string(),
  data: stateSchema,
})

/** Por padrão o backup não leva as chaves (token do GitHub e chave do RAWG). */
export function createBackup(state: PersistedState, includeKeys = false): string {
  const settings = { ...state.settings }
  if (!includeKeys) {
    delete settings.githubToken
    delete settings.rawgKey
  }
  const payload = {
    app: BACKUP_APP,
    exportedAt: new Date().toISOString(),
    data: { ...state, settings },
  }
  return JSON.stringify(payload, null, 2)
}

export function backupFileName(date = new Date()): string {
  const d = date.toISOString().slice(0, 10)
  return `minhas-platinas-backup-${d}.json`
}

export type ParseBackupResult =
  | { ok: true; data: PersistedState; exportedAt: string }
  | { ok: false; error: string }

export function parseBackup(text: string): ParseBackupResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' }
  }
  if (!json || typeof json !== 'object' || (json as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, error: 'Este arquivo não é um backup do Minhas Platinas.' }
  }
  const result = backupSchema.safeParse(json)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue?.path.join('.') || 'raiz'
    return { ok: false, error: `Backup inválido (${path}): ${issue?.message ?? 'formato inesperado'}` }
  }
  const data = result.data.data
  const ids = new Set(data.games.map((g) => g.id))
  const orphan = data.backlog.find((id) => !ids.has(id))
  if (orphan) return { ok: false, error: 'Backup inválido: o backlog referencia um jogo que não existe.' }
  return { ok: true, data, exportedAt: result.data.exportedAt }
}
