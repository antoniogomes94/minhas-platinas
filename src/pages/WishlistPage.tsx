import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Heart, ListPlus, LoaderCircle, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { toast } from '../store/useToastStore'
import { useGameInfo } from '../lib/gameData'
import { useStartScrape } from '../lib/github'
import { Cover } from '../components/Cover'
import { GameSearch } from '../components/GameSearch'
import { catalogFromSuggestion, fetchCatalog, type Suggestion } from '../lib/rawg'
import { coverOf } from '../lib/cover'
import { DifficultyChip, FetchStatusChip, HoursChip, UnobtainableRibbon } from '../components/badges'
import { BACKLOG_LIMIT, PLATFORMS, type CatalogInfo, type Game, type Platform } from '../types'

function AddGameForm() {
  const addGame = useAppStore((s) => s.addGame)
  const hasToken = useAppStore((s) => !!s.settings.githubToken)
  const rawgKey = useAppStore((s) => s.settings.rawgKey)
  const startScrape = useStartScrape()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [autoFetch, setAutoFetch] = useState(true)
  const [picked, setPicked] = useState<Suggestion | null>(null)
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const detailsAbort = useRef<AbortController | null>(null)

  function clearPick() {
    detailsAbort.current?.abort()
    setPicked(null)
    setCatalog(null)
    setDetailsLoading(false)
  }

  async function pick(s: Suggestion) {
    clearPick()
    setPicked(s)
    setName(s.name)
    setPlatform(s.platforms[0] ?? '')
    if (!rawgKey) return
    const controller = new AbortController()
    detailsAbort.current = controller
    setDetailsLoading(true)
    try {
      setCatalog(await fetchCatalog(rawgKey, s.id, controller.signal))
    } catch (err) {
      if (!controller.signal.aborted) {
        toast(`Não deu para carregar developer e publisher: ${err instanceof Error ? err.message : err}`, 'error')
      }
    } finally {
      if (!controller.signal.aborted) setDetailsLoading(false)
    }
  }

  function add() {
    const info = picked ? (catalog ?? catalogFromSuggestion(picked)) : undefined
    const result = addGame(name, platform || undefined, info)
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    setName('')
    clearPick()
    toast(`"${result.game.name}" adicionado à lista de desejos.`, 'success')
    if (autoFetch && hasToken) void startScrape(result.game)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim() && !detailsLoading) add()
  }

  // Com sugestão escolhida, só as plataformas em que o jogo existe.
  const platformOptions = picked?.platforms.length ? picked.platforms : PLATFORMS
  const details = catalog ?? (picked ? catalogFromSuggestion(picked) : null)

  return (
    <form onSubmit={submit} className="card relative z-20 space-y-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="game-name" className="label">
            Nome do jogo
          </label>
          <GameSearch
            id="game-name"
            apiKey={rawgKey}
            value={name}
            placeholder={rawgKey ? 'Comece a digitar: Ghost of Tsu…' : 'Ex.: Ghost of Tsushima'}
            onChange={(v) => {
              setName(v)
              if (picked && v !== picked.name) clearPick()
            }}
            onPick={(s) => void pick(s)}
            onSubmitText={() => name.trim() && !detailsLoading && add()}
          />
        </div>
        <div className="sm:w-32">
          <label htmlFor="game-platform" className="label">
            Plataforma
          </label>
          <select
            id="game-platform"
            className="input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | '')}
          >
            <option value="">—</option>
            {platformOptions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
          <label
            className={`flex items-center gap-2 text-xs ${hasToken ? 'text-muted' : 'text-muted/50'}`}
            title={hasToken ? undefined : 'Configure o token do GitHub no Perfil'}
          >
            <input
              type="checkbox"
              checked={autoFetch && hasToken}
              disabled={!hasToken}
              onChange={(e) => setAutoFetch(e.target.checked)}
              className="accent-ps"
            />
            Buscar dados ao adicionar
          </label>
          <button type="submit" className="btn-primary" disabled={!name.trim() || detailsLoading}>
            {detailsLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar
          </button>
        </div>
      </div>

      {picked && details && (
        <div className="flex gap-4 rounded-xl border border-ps-light/30 bg-ps/5 p-3">
          <div className="hidden aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:block">
            {picked.thumb && <img src={picked.thumb} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="font-semibold">
              {details.name}
              {picked.year && <span className="ml-2 font-normal text-muted">{picked.year}</span>}
              {details.metacritic != null && (
                <span className="ml-2 rounded border border-line px-1.5 text-xs text-muted">Metacritic {details.metacritic}</span>
              )}
            </p>
            {detailsLoading ? (
              <p className="flex items-center gap-2 text-muted">
                <LoaderCircle size={14} className="animate-spin" /> Carregando developer e publisher…
              </p>
            ) : (
              <>
                <p className="text-muted">
                  <span className="text-ink/80">Developer:</span> {details.developers.join(', ') || '—'}
                </p>
                <p className="text-muted">
                  <span className="text-ink/80">Publisher:</span> {details.publishers.join(', ') || '—'}
                </p>
              </>
            )}
            {details.genres.length > 0 && <p className="text-xs text-muted">{details.genres.join(' · ')}</p>}
          </div>
          <button type="button" onClick={clearPick} className="self-start text-muted hover:text-ink" aria-label="Desfazer escolha">
            <X size={16} />
          </button>
        </div>
      )}

      {!rawgKey && (
        <p className="text-xs text-muted">
          Quer sugestões com capa, developer e publisher enquanto digita?{' '}
          <Link to="/perfil" className="text-ps-light hover:underline">
            Cole uma chave grátis do RAWG no Perfil
          </Link>
          .
        </p>
      )}
    </form>
  )
}

function GameCard({ game, backlogPos }: { game: Game; backlogPos: number }) {
  const { info } = useGameInfo(game.slug)
  const addToBacklog = useAppStore((s) => s.addToBacklog)
  const removeGame = useAppStore((s) => s.removeGame)
  const backlogFull = useAppStore((s) => s.backlog.length >= BACKLOG_LIMIT)
  const startScrape = useStartScrape()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inBacklog = backlogPos >= 0
  const pending = game.fetch?.status === 'pending'

  function toBacklog() {
    if (addToBacklog(game.id)) toast(`"${game.name}" entrou no backlog.`, 'success')
    else toast(`O backlog já tem ${BACKLOG_LIMIT} jogos. Tire um antes de adicionar outro.`, 'error')
  }

  return (
    <article className="card group relative flex flex-col overflow-hidden">
      <Link to={`/jogo/${game.id}`} className="relative block aspect-[16/9] overflow-hidden">
        <Cover
          src={coverOf(game, info)}
          name={game.name}
          className="h-full w-full transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
        {info?.unobtainable.flag && <UnobtainableRibbon reason={info.unobtainable.reason} />}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {game.platform && <span className="chip">{game.platform}</span>}
          {info?.difficulty.value != null && <DifficultyChip value={info.difficulty.value} />}
          {info?.timeHours.value && <HoursChip value={info.timeHours.value} />}
          <FetchStatusChip fetch={game.fetch} />
        </div>
        {inBacklog && (
          <span className="chip absolute top-2 left-2 border-ps-light/50 text-ps-light">#{backlogPos + 1} no backlog</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <Link to={`/jogo/${game.id}`} className="line-clamp-2 font-semibold leading-tight hover:text-ps-light">
          {game.name}
        </Link>

        <div className="mt-auto flex items-center gap-2">
          {inBacklog ? (
            <span className="btn flex-1 cursor-default text-ok">
              <Check size={16} /> No backlog
            </span>
          ) : (
            <button
              className="btn-primary flex-1"
              onClick={toBacklog}
              disabled={backlogFull}
              title={backlogFull ? `Backlog cheio (${BACKLOG_LIMIT}/${BACKLOG_LIMIT})` : undefined}
            >
              <ListPlus size={16} /> Backlog
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => void startScrape(game)}
            disabled={pending}
            aria-label={info ? 'Atualizar dados' : 'Buscar dados'}
            title={info ? 'Atualizar dados' : 'Buscar dados'}
          >
            <RefreshCw size={16} className={pending ? 'animate-spin' : ''} />
          </button>
          {confirmDelete ? (
            <>
              <button className="btn-danger" onClick={() => removeGame(game.id)}>
                Excluir
              </button>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                Não
              </button>
            </>
          ) : (
            <button
              className="btn-ghost hover:text-danger"
              onClick={() => setConfirmDelete(true)}
              aria-label="Excluir da lista"
              title="Excluir da lista"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function WishlistPage() {
  const games = useAppStore((s) => s.games)
  const backlog = useAppStore((s) => s.backlog)
  const [query, setQuery] = useState('')
  const [hideBacklog, setHideBacklog] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games.filter((g) => (!q || g.name.toLowerCase().includes(q)) && (!hideBacklog || !backlog.includes(g.id)))
  }, [games, backlog, query, hideBacklog])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Heart className="text-ps-light" /> Lista de desejos
        </h1>
        <p className="mt-1 text-sm text-muted">Todos os jogos que você quer platinar. Mande até {BACKLOG_LIMIT} para o backlog.</p>
      </div>

      <AddGameForm />

      {games.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              placeholder="Filtrar pelo nome"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filtrar pelo nome"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={hideBacklog}
              onChange={(e) => setHideBacklog(e.target.checked)}
              className="accent-ps"
            />
            Ocultar os que já estão no backlog
          </label>
        </div>
      )}

      {games.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          <Heart className="mx-auto mb-3 opacity-40" size={40} />
          Sua lista está vazia. Adicione o primeiro jogo acima.
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhum jogo com esse filtro.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((g) => (
            <GameCard key={g.id} game={g} backlogPos={backlog.indexOf(g.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
