import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Heart, ListPlus, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { toast } from '../store/useToastStore'
import { useGameInfo } from '../lib/gameData'
import { useStartScrape } from '../lib/github'
import { Cover } from '../components/Cover'
import { DifficultyChip, FetchStatusChip, HoursChip, UnobtainableRibbon } from '../components/badges'
import { BACKLOG_LIMIT, PLATFORMS, type Game, type Platform } from '../types'

function AddGameForm() {
  const addGame = useAppStore((s) => s.addGame)
  const hasToken = useAppStore((s) => !!s.settings.githubToken)
  const startScrape = useStartScrape()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [autoFetch, setAutoFetch] = useState(true)

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = addGame(name, platform || undefined)
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    setName('')
    toast(`"${result.game.name}" adicionado à lista de desejos.`, 'success')
    if (autoFetch && hasToken) void startScrape(result.game)
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="game-name" className="label">
          Nome do jogo
        </label>
        <input
          id="game-name"
          className="input"
          placeholder="Ex.: Ghost of Tsushima"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
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
          {PLATFORMS.map((p) => (
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
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          <Plus size={16} /> Adicionar
        </button>
      </div>
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
          src={game.coverUrl || info?.cover}
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
