import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { LoaderCircle, Search, Star } from 'lucide-react'
import { RAWG_URL, searchGames, type Suggestion } from '../lib/rawg'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

interface Props {
  id: string
  apiKey?: string
  value: string
  onChange: (value: string) => void
  onPick: (suggestion: Suggestion) => void
  /** Enter sem sugestão destacada */
  onSubmitText: () => void
  placeholder?: string
}

function metacriticClass(score: number) {
  if (score >= 75) return 'border-ok/50 text-ok'
  if (score >= 50) return 'border-warn/50 text-warn'
  return 'border-danger/50 text-danger'
}

/** Campo de nome com sugestões do RAWG enquanto digita (combobox acessível). */
export function GameSearch({ id, apiKey, value, onChange, onPick, onSubmitText, placeholder }: Props) {
  const listId = useId()
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [searched, setSearched] = useState('')
  const skipNext = useRef(false)

  const query = value.trim()
  const enabled = !!apiKey?.trim()

  useEffect(() => {
    // Depois de escolher uma sugestão o texto muda para o nome dela; não busca de novo.
    if (skipNext.current) {
      skipNext.current = false
      return
    }
    if (!enabled || query.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const found = await searchGames(apiKey!, query, controller.signal)
        setResults(found)
        setSearched(query)
        setActive(-1)
        setOpen(true)
      } catch (err) {
        if (controller.signal.aborted) return
        setResults([])
        setError(err instanceof Error ? err.message : 'Falha ao buscar sugestões.')
        setOpen(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, enabled, apiKey])

  function pick(s: Suggestion) {
    skipNext.current = true
    onPick(s)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = open ? results[active] : undefined
      if (chosen) pick(chosen)
      else {
        setOpen(false)
        onSubmitText()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && enabled && query.length >= MIN_CHARS && (loading || error || searched === query)

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        id={id}
        className="input pr-9 pl-9"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={!!showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {loading && (
        <LoaderCircle size={16} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-ps-light" />
      )}

      {showList && (
        <div
          // mousedown não pode tirar o foco do input antes do clique na sugestão
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
        >
          <ul id={listId} role="listbox" className="max-h-96 overflow-y-auto py-1">
            {error && <li className="px-3 py-3 text-sm text-danger">{error}</li>}
            {!error && loading && results.length === 0 && <li className="px-3 py-3 text-sm text-muted">Buscando…</li>}
            {!error && !loading && results.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">
                Nenhum jogo de PlayStation encontrado. <kbd className="text-ink">Enter</kbd> adiciona "{query}" mesmo assim.
              </li>
            )}
            {results.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-ps/20' : ''}`}
              >
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {s.thumb && <img src={s.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {s.year && <span>{s.year}</span>}
                    {s.platforms.map((p) => (
                      <span key={p} className="rounded border border-line px-1 text-[10px] text-ink/80">
                        {p}
                      </span>
                    ))}
                    {s.genres.slice(0, 2).length > 0 && <span className="truncate">· {s.genres.slice(0, 2).join(', ')}</span>}
                  </p>
                </div>
                {s.metacritic != null && (
                  <span
                    className={`flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-bold ${metacriticClass(s.metacritic)}`}
                    title="Metacritic"
                  >
                    <Star size={10} /> {s.metacritic}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-muted">
            <span>↑↓ navegar · Enter escolher · Esc fechar</span>
            <a href={RAWG_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
              Dados: RAWG
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
