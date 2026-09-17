import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Bug,
  Building2,
  CircleCheck,
  CircleMinus,
  CircleX,
  ExternalLink,
  Lightbulb,
  ListMinus,
  ListPlus,
  Map as MapIcon,
  Pencil,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Video,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { toast } from '../store/useToastStore'
import { useGameInfo } from '../lib/gameData'
import { actionsUrl, useStartScrape } from '../lib/github'
import { Cover } from '../components/Cover'
import {
  difficultyColor,
  FetchStatusChip,
  formatHours,
  formatNumber,
  SourceBadge,
  unobtainableLabel,
  UnobtainableRibbon,
} from '../components/badges'
import {
  BACKLOG_LIMIT,
  SITE_LABELS,
  SOURCE_SITES,
  type Field,
  type Game,
  type GameInfo,
  type LinkItem,
  type SourceSite,
  type TipKind,
} from '../types'

const DASH = <span className="text-muted">—</span>

function Panel({ title, icon: Icon, children, id }: { title: string; icon: typeof Bug; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon size={18} className="text-ps-light" /> {title}
      </h2>
      {children}
    </section>
  )
}

function Readings<T>({ field, format }: { field: Field<T>; format: (v: T) => string }) {
  if (field.readings.length < 2 && field.site) return <SourceBadge site={field.site} />
  if (field.readings.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {field.readings.map((r) => (
        <span key={r.site} title={r.raw} className="text-[11px] text-muted">
          <SourceBadge site={r.site} /> {format(r.value)}
        </span>
      ))}
    </span>
  )
}

function Stat<T>({
  label,
  field,
  format,
  valueClass = '',
}: {
  label: string
  field: Field<T>
  format: (v: T) => string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className={`mt-1 text-xl font-bold ${valueClass}`}>{field.value === null ? DASH : format(field.value)}</dd>
      <dd className="mt-1.5">
        <Readings field={field} format={format} />
      </dd>
    </div>
  )
}

const yesNo = (v: boolean) => (v ? 'Sim' : 'Não')

const TIP_STYLE: Record<TipKind, { label: string; className: string }> = {
  macete: { label: 'Macete', className: 'border-ok/40 text-ok' },
  bug: { label: 'Bug', className: 'border-warn/40 text-warn' },
  glitch: { label: 'Glitch', className: 'border-warn/40 text-warn' },
  cheat: { label: 'Cheat', className: 'border-ps-light/40 text-ps-light' },
}

function LinkList({ items, empty }: { items: LinkItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line/60">
      {items.map((l) => (
        <li key={l.url}>
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 py-2 text-sm hover:text-ps-light"
          >
            <span className="w-28 shrink-0 text-xs font-medium text-muted">{l.site}</span>
            <span className="flex-1">{l.title}</span>
            {l.lang && <span className="text-[10px] text-muted uppercase">{l.lang}</span>}
            <ExternalLink size={14} className="shrink-0 opacity-50" />
          </a>
        </li>
      ))}
    </ul>
  )
}

function GuidesPanel({ guides }: { guides: LinkItem[] }) {
  const main = ['PSNProfiles', 'PowerPyx', 'MyPST', 'PSX Trophies']
  const ordered = [
    ...main.flatMap((site) => guides.filter((g) => g.site === site)),
    ...guides.filter((g) => !main.includes(g.site)),
  ]
  return (
    <Panel title="Guias" icon={BookOpen}>
      <LinkList items={ordered} empty="Nenhum guia encontrado." />
    </Panel>
  )
}

function InfoView({ info }: { info: GameInfo }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="Desenvolvimento" icon={Building2}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase">Developer</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {info.developers.value?.length ? info.developers.value.join(', ') : DASH}
                {info.developers.site && <SourceBadge site={info.developers.site} />}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase">Publisher</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {info.publishers.value?.length ? info.publishers.value.join(', ') : DASH}
                {info.publishers.site && <SourceBadge site={info.publishers.site} />}
              </dd>
            </div>
          </dl>
        </Panel>
        <div className="md:col-span-2">
          <Panel title="Resumo da platina" icon={Sparkles}>
            {info.summary.value ? (
              <>
                <p className="text-sm leading-relaxed text-ink/90">{info.summary.value}</p>
                {info.summary.site && (
                  <div className="mt-2">
                    <SourceBadge site={info.summary.site} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Sem resumo nas fontes.</p>
            )}
          </Panel>
        </div>
      </div>

      {info.unobtainable.flag && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/50 bg-danger/10 p-4">
          <TriangleAlert className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-bold text-danger uppercase">{unobtainableLabel(info.unobtainable.reason)}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {info.unobtainable.notes.map((n, i) => (
                <li key={i}>
                  <SourceBadge site={n.site} /> {n.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Autopop" field={info.autopop} format={yesNo} />
        <Stat
          label="Dificuldade estimada"
          field={info.difficulty}
          format={(v) => `${formatNumber(v)}/10`}
          valueClass={info.difficulty.value != null ? difficultyColor(info.difficulty.value) : ''}
        />
        <Stat label="Tempo estimado" field={info.timeHours} format={formatHours} />
        <Stat label="Nº de jogadas" field={info.playthroughs} format={(v) => String(v)} />
        <Stat label="Troféus offline" field={info.offlineTrophies} format={(v) => String(v)} />
        <Stat label="Troféus online" field={info.onlineTrophies} format={(v) => String(v)} />
        <Stat label="Troféus perdíveis" field={info.missableTrophies} format={(v) => String(v)} />
        <Stat label="Troféus bugados" field={info.glitchedTrophies} format={(v) => String(v)} />
        <Stat label="Dificuldade afeta os troféus" field={info.difficultyAffects} format={yesNo} />
        <Stat label="Dificuldade (comunidade PSX)" field={info.communityDifficulty} format={formatNumber} />
      </dl>

      <Panel title="Macetes, bugs, glitches e cheats" icon={Lightbulb}>
        {info.tips.length === 0 ? (
          <p className="text-sm text-muted">Nada encontrado nas fontes.</p>
        ) : (
          <ul className="space-y-3">
            {info.tips.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className={`chip h-fit shrink-0 ${TIP_STYLE[t.kind].className}`}>{TIP_STYLE[t.kind].label}</span>
                <div className="flex-1">
                  <p className="leading-relaxed">{t.text}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <SourceBadge site={t.site} />
                    {t.url && (
                      <a href={t.url} target="_blank" rel="noreferrer" className="text-xs text-ps-light hover:underline">
                        ver na fonte
                      </a>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <GuidesPanel guides={info.guides} />
        <div className="min-w-0 space-y-4">
          <Panel title="Vídeos" icon={Video}>
            {info.videos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum vídeo encontrado.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {info.videos.map((v) => (
                  <li key={v.url}>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 py-2 text-sm hover:text-ps-light"
                    >
                      <span className="font-medium">{v.channel}</span>
                      {v.title && <span className="flex-1 truncate text-muted">{v.title}</span>}
                      <ExternalLink size={14} className="ml-auto shrink-0 opacity-50" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Mapas" icon={MapIcon}>
            <LinkList items={info.maps} empty="Nenhum mapa encontrado." />
          </Panel>
        </div>
      </div>

      <Panel title="Fontes consultadas" icon={CircleCheck}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {info.sources.map((s) => (
            <li key={s.site} className="flex items-center gap-2 text-sm">
              {s.ok ? (
                <CircleCheck size={16} className="shrink-0 text-ok" />
              ) : s.url ? (
                <CircleX size={16} className="shrink-0 text-danger" />
              ) : (
                <CircleMinus size={16} className="shrink-0 text-muted" />
              )}
              <span className="font-medium">{SITE_LABELS[s.site]}</span>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-xs text-ps-light hover:underline">
                  {s.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              ) : (
                <span className="truncate text-xs text-muted" title={s.error}>
                  {s.error ?? 'não encontrado'}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Coletado em {new Date(info.scrapedAt).toLocaleString('pt-BR')}. Se algum site achou o jogo errado, corrija o link
          abaixo e atualize.
        </p>
      </Panel>
    </div>
  )
}

function EditLinksForm({ game, onDone }: { game: Game; onDone: () => void }) {
  const setSourceUrls = useAppStore((s) => s.setSourceUrls)
  const updateGame = useAppStore((s) => s.updateGame)
  const [urls, setUrls] = useState<Partial<Record<SourceSite, string>>>(game.sourceUrls ?? {})
  const [cover, setCover] = useState(game.coverUrl ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    setSourceUrls(game.id, urls)
    updateGame(game.id, { coverUrl: cover.trim() || undefined })
    toast('Links salvos. Clique em "Atualizar dados" para coletar de novo.', 'success')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">Deixe em branco para o crawler procurar sozinho.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCE_SITES.map((site) => (
          <div key={site}>
            <label htmlFor={`url-${site}`} className="label">
              {SITE_LABELS[site]}
            </label>
            <input
              id={`url-${site}`}
              type="url"
              className="input"
              placeholder="https://…"
              value={urls[site] ?? ''}
              onChange={(e) => setUrls({ ...urls, [site]: e.target.value })}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label htmlFor="url-cover" className="label">
            Imagem da capa (opcional)
          </label>
          <input
            id="url-cover"
            type="url"
            className="input"
            placeholder="https://…"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Salvar links
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function GamePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const game = useAppStore((s) => s.games.find((g) => g.id === id))
  const backlogPos = useAppStore((s) => (id ? s.backlog.indexOf(id) : -1))
  const backlogFull = useAppStore((s) => s.backlog.length >= BACKLOG_LIMIT)
  const addToBacklog = useAppStore((s) => s.addToBacklog)
  const removeFromBacklog = useAppStore((s) => s.removeFromBacklog)
  const settings = useAppStore((s) => s.settings)
  const { info, loaded } = useGameInfo(game?.slug)
  const startScrape = useStartScrape()
  const [editing, setEditing] = useState(false)

  if (!game) {
    return (
      <div className="card p-10 text-center text-muted">
        Jogo não encontrado.{' '}
        <Link to="/desejos" className="text-ps-light hover:underline">
          Voltar para a lista
        </Link>
      </div>
    )
  }

  const pending = game.fetch?.status === 'pending'
  const inBacklog = backlogPos >= 0

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Voltar
      </button>

      <header className="relative overflow-hidden rounded-2xl border border-line">
        <Cover src={game.coverUrl || info?.cover} name={game.name} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/30" />
        {info?.unobtainable.flag && <UnobtainableRibbon reason={info.unobtainable.reason} />}
        <div className="relative flex min-h-56 flex-col justify-end gap-3 p-5 sm:min-h-72">
          <div className="flex flex-wrap gap-2">
            {game.platform && <span className="chip">{game.platform}</span>}
            {inBacklog && <span className="chip text-ps-light">#{backlogPos + 1} no backlog</span>}
            <FetchStatusChip fetch={game.fetch} />
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{game.name}</h1>
          <div className="flex flex-wrap gap-2">
            {inBacklog ? (
              <button className="btn-ghost" onClick={() => removeFromBacklog(game.id)}>
                <ListMinus size={16} /> Tirar do backlog
              </button>
            ) : (
              <button
                className="btn-primary"
                disabled={backlogFull}
                onClick={() => addToBacklog(game.id) && toast('Adicionado ao backlog.', 'success')}
                title={backlogFull ? `Backlog cheio (${BACKLOG_LIMIT}/${BACKLOG_LIMIT})` : undefined}
              >
                <ListPlus size={16} /> Adicionar ao backlog
              </button>
            )}
            <button className="btn-ghost" disabled={pending} onClick={() => void startScrape(game)}>
              <RefreshCw size={16} className={pending ? 'animate-spin' : ''} />
              {info ? 'Atualizar dados' : 'Buscar dados'}
            </button>
            <button className="btn-ghost" onClick={() => setEditing((v) => !v)}>
              <Pencil size={16} /> Links das fontes
            </button>
            {pending && settings.githubOwner && (
              <a className="btn-ghost" href={actionsUrl(settings)} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Acompanhar no GitHub
              </a>
            )}
          </div>
          {game.fetch?.error && game.fetch.status !== 'pending' && (
            <p className="text-sm text-warn">{game.fetch.error}</p>
          )}
        </div>
      </header>

      {editing && (
        <Panel title="Links das fontes" icon={Pencil}>
          <EditLinksForm game={game} onDone={() => setEditing(false)} />
        </Panel>
      )}

      {!loaded ? (
        <p className="p-6 text-center text-sm text-muted">Carregando…</p>
      ) : info ? (
        <InfoView info={info} />
      ) : (
        <div className="card p-10 text-center text-muted">
          <p>Ainda não há dados coletados para este jogo.</p>
          <p className="mt-1 text-sm">
            Clique em <strong className="text-ink">Buscar dados</strong> para o GitHub Actions consultar PowerPyx,
            PSNProfiles, MyPST e PSX Trophies.
          </p>
        </div>
      )}
    </div>
  )
}
