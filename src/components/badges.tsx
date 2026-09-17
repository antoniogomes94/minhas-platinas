import { Clock, Gauge, Globe, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { FetchStatus, GameFetch, HoursRange, SourceSite, UnobtainableReason } from '../types'
import { SITE_LABELS } from '../types'

export function difficultyColor(value: number): string {
  if (value <= 3) return 'text-ok'
  if (value <= 5) return 'text-lime-300'
  if (value <= 7) return 'text-warn'
  return 'text-danger'
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export function formatHours(h: HoursRange): string {
  return h.min === h.max ? `${formatNumber(h.min)} h` : `${formatNumber(h.min)}–${formatNumber(h.max)} h`
}

export function DifficultyChip({ value }: { value: number }) {
  return (
    <span className="chip" title="Dificuldade estimada (0–10)">
      <Gauge size={12} className={difficultyColor(value)} />
      <span className={difficultyColor(value)}>{formatNumber(value)}</span>
      <span className="text-muted">/10</span>
    </span>
  )
}

export function HoursChip({ value }: { value: HoursRange }) {
  return (
    <span className="chip" title="Tempo estimado">
      <Clock size={12} className="text-platinum" />
      {formatHours(value)}
    </span>
  )
}

export function OnlineChip({ count }: { count: number }) {
  return (
    <span className="chip" title="Troféus online">
      <Globe size={12} className="text-ps-light" />
      {count} online
    </span>
  )
}

export function SourceBadge({ site }: { site: SourceSite | 'rawg' }) {
  return (
    <span className="rounded border border-line bg-surface-2 px-1.5 py-px text-[10px] font-medium tracking-wide text-muted uppercase">
      {site === 'rawg' ? 'RAWG' : SITE_LABELS[site]}
    </span>
  )
}

const REASON_LABEL: Record<UnobtainableReason, string> = {
  servers: 'Servidores fechados',
  delisted: 'Implatinável',
  glitched: 'Implatinável',
  other: 'Implatinável',
}

export function unobtainableLabel(reason: UnobtainableReason | null): string {
  return reason ? REASON_LABEL[reason] : 'Implatinável'
}

/** Faixa diagonal no canto superior direito. O elemento pai precisa de `relative overflow-hidden`. */
export function UnobtainableRibbon({ reason }: { reason: UnobtainableReason | null }) {
  return (
    <div className="pointer-events-none absolute top-0 right-0 z-10 h-40 w-40 overflow-hidden">
      <div className="absolute top-[46px] -right-[56px] w-60 rotate-45 bg-danger py-1 text-center text-[10px] font-bold tracking-wide whitespace-nowrap text-white uppercase shadow-lg shadow-black/50">
        {unobtainableLabel(reason)}
      </div>
    </div>
  )
}

const FETCH_LABEL: Record<FetchStatus, string> = {
  idle: '',
  pending: 'Buscando…',
  done: 'Atualizado',
  error: 'Erro na busca',
  timeout: 'Demorou demais',
}

export function FetchStatusChip({ fetch }: { fetch?: GameFetch }) {
  if (!fetch || fetch.status === 'idle' || fetch.status === 'done') return null
  const pending = fetch.status === 'pending'
  return (
    <span
      className={`chip ${pending ? 'text-ps-light' : 'text-warn'}`}
      title={fetch.error ?? (pending ? 'O GitHub Actions está coletando os dados' : undefined)}
    >
      {pending ? <LoaderCircle size={12} className="animate-spin" /> : <TriangleAlert size={12} />}
      {FETCH_LABEL[fetch.status]}
    </span>
  )
}
