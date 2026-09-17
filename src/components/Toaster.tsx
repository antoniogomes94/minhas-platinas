import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useToastStore } from '../store/useToastStore'

const ICONS = { info: Info, success: CircleCheck, error: TriangleAlert }
const COLORS = {
  info: 'border-ps-light/40 text-ps-light',
  success: 'border-ok/40 text-ok',
  error: 'border-danger/50 text-danger',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface/95 px-4 py-3 text-sm shadow-2xl backdrop-blur ${COLORS[t.kind]}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-ink">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Fechar aviso">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
