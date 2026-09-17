import { useCallback, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { toast } from '../store/useToastStore'
import type { Game, Settings } from '../types'
import { fetchGameInfo, useGameInfoStore } from './gameData'

export const SCRAPE_WORKFLOW = 'scrape.yml'
const POLL_INTERVAL_MS = 30_000
const POLL_TIMEOUT_MS = 15 * 60_000

export function settingsProblem(settings: Settings): string | null {
  if (!settings.githubOwner.trim() || !settings.githubRepo.trim()) {
    return 'Configure o usuário e o repositório do GitHub no Perfil.'
  }
  if (!settings.githubToken?.trim()) return 'Cole um token do GitHub no Perfil para buscar dados.'
  return null
}

export function actionsUrl(settings: Settings): string {
  return `https://github.com/${settings.githubOwner}/${settings.githubRepo}/actions/workflows/${SCRAPE_WORKFLOW}`
}

export async function dispatchScrape(settings: Settings, game: Game): Promise<void> {
  const problem = settingsProblem(settings)
  if (problem) throw new Error(problem)

  const url = `https://api.github.com/repos/${encodeURIComponent(settings.githubOwner.trim())}/${encodeURIComponent(
    settings.githubRepo.trim(),
  )}/actions/workflows/${SCRAPE_WORKFLOW}/dispatches`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.githubToken!.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        slug: game.slug,
        name: game.name,
        platform: game.platform ?? '',
        urls: JSON.stringify(game.sourceUrls ?? {}),
      },
    }),
  })

  if (res.status === 204) return
  const detail = await res.text().catch(() => '')
  switch (res.status) {
    case 401:
      throw new Error('Token do GitHub inválido ou expirado.')
    case 403:
      throw new Error('O token não tem permissão "Actions: read and write" neste repositório.')
    case 404:
      throw new Error('Repositório ou workflow scrape.yml não encontrado. Confira usuário, repositório e o token.')
    case 422:
      throw new Error(`O GitHub recusou os parâmetros do workflow: ${detail.slice(0, 200)}`)
    default:
      throw new Error(`Erro ${res.status} ao chamar o GitHub: ${detail.slice(0, 200)}`)
  }
}

/** Dispara a coleta de um jogo e marca como pendente. */
export function useStartScrape() {
  return useCallback(async (game: Game) => {
    const { settings, setFetch } = useAppStore.getState()
    // Falta de configuração não é erro do jogo: só avisa.
    const problem = settingsProblem(settings)
    if (problem) {
      toast(problem, 'error')
      return
    }
    const requestedAt = new Date().toISOString()
    try {
      const current = await fetchGameInfo(game.slug, true).catch(() => null)
      await dispatchScrape(settings, game)
      setFetch(game.id, { status: 'pending', requestedAt, previousScrapedAt: current?.scrapedAt ?? null })
      toast(`Buscando dados de "${game.name}". Leva de 1 a 3 minutos.`, 'info')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFetch(game.id, { status: 'error', requestedAt, error: message })
      toast(message, 'error')
    }
  }, [])
}

async function checkPending() {
  const { games, setFetch } = useAppStore.getState()
  const pending = games.filter((g) => g.fetch?.status === 'pending' && g.fetch.requestedAt)
  for (const game of pending) {
    const requestedAt = Date.parse(game.fetch!.requestedAt!)
    const info = await fetchGameInfo(game.slug, true).catch(() => null)
    // Compara com o scrapedAt anterior em vez do relógio local, que pode estar diferente do GitHub.
    if (info && info.scrapedAt !== (game.fetch!.previousScrapedAt ?? null)) {
      useGameInfoStore.getState().set(game.slug, info)
      setFetch(game.id, { status: 'done', requestedAt: game.fetch!.requestedAt })
      toast(`Dados de "${game.name}" atualizados.`, 'success')
    } else if (Date.now() - requestedAt > POLL_TIMEOUT_MS) {
      setFetch(game.id, {
        status: 'timeout',
        requestedAt: game.fetch!.requestedAt,
        error: 'A coleta não terminou em 15 minutos. Veja a aba Actions no GitHub.',
      })
    }
  }
}

/** Montado uma vez no App: acompanha coletas pendentes, inclusive depois de recarregar a página. */
export function usePendingScrapePoller() {
  const hasPending = useAppStore((s) => s.games.some((g) => g.fetch?.status === 'pending'))
  useEffect(() => {
    if (!hasPending) return
    void checkPending()
    const timer = setInterval(() => void checkPending(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasPending])
}
