import { Link } from 'react-router-dom'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, Heart, ListOrdered, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { toast } from '../store/useToastStore'
import { useGameInfo } from '../lib/gameData'
import { Cover } from '../components/Cover'
import { DifficultyChip, FetchStatusChip, HoursChip, OnlineChip, UnobtainableRibbon } from '../components/badges'
import { BACKLOG_LIMIT, type Game } from '../types'

// Impede que clicar/tocar em links e botões dentro do banner inicie o arraste.
const noDrag = {
  onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(),
}

function BacklogBanner({ game, position }: { game: Game; position: number }) {
  const { info } = useGameInfo(game.slug)
  const removeFromBacklog = useAppStore((s) => s.removeFromBacklog)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: game.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  function remove() {
    removeFromBacklog(game.id)
    toast(`"${game.name}" voltou para a lista de desejos.`, 'info')
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative list-none ${isDragging ? 'z-20' : 'z-0'}`}
      aria-label={`${position}º: ${game.name}`}
    >
      <div
        {...listeners}
        className={`group relative flex min-h-32 cursor-grab touch-pan-y items-stretch overflow-hidden rounded-2xl border bg-surface select-none active:cursor-grabbing sm:min-h-40 ${
          isDragging
            ? 'scale-[1.02] border-ps-light shadow-2xl shadow-ps/30'
            : 'border-line shadow-lg shadow-black/30 hover:border-ps-light/50'
        } transition-[transform,box-shadow,border-color]`}
      >
        {/* capa ocupando o banner inteiro */}
        <Cover src={game.coverUrl || info?.cover} name={game.name} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/10" />
        {info?.unobtainable.flag && <UnobtainableRibbon reason={info.unobtainable.reason} />}

        {/* alça (também é o ativador do teclado) */}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          className="relative z-10 flex w-10 shrink-0 cursor-grab touch-none items-center justify-center text-muted hover:text-ink active:cursor-grabbing sm:w-12"
          aria-label={`Reordenar ${game.name}. Use espaço e as setas.`}
        >
          <GripVertical size={22} />
        </button>

        <div
          className={`relative z-10 flex min-w-0 flex-1 items-center gap-3 py-3 sm:gap-5 ${
            info?.unobtainable.flag ? 'pr-16' : 'pr-3'
          }`}
        >
          <span className="w-10 shrink-0 text-center text-4xl font-black text-platinum/80 tabular-nums sm:w-14 sm:text-5xl">
            {position}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              to={`/jogo/${game.id}`}
              {...noDrag}
              className="inline-flex max-w-full items-center gap-1 text-lg font-bold leading-tight hover:text-ps-light sm:text-2xl"
            >
              <span className="line-clamp-2">{game.name}</span>
              <ChevronRight size={18} className="shrink-0 opacity-50" />
            </Link>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {game.platform && <span className="chip">{game.platform}</span>}
              {info?.difficulty.value != null && <DifficultyChip value={info.difficulty.value} />}
              {info?.timeHours.value && <HoursChip value={info.timeHours.value} />}
              {!!info?.onlineTrophies.value && <OnlineChip count={info.onlineTrophies.value} />}
              <FetchStatusChip fetch={game.fetch} />
            </div>
          </div>
          <button
            onClick={remove}
            {...noDrag}
            className="btn relative z-20 self-end border border-white/10 bg-black/50 text-muted backdrop-blur hover:border-danger/60 hover:text-danger sm:self-center"
            aria-label={`Tirar ${game.name} do backlog`}
            title="Tirar do backlog (volta para a lista de desejos)"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </li>
  )
}

export function BacklogPage() {
  const games = useAppStore((s) => s.games)
  const backlog = useAppStore((s) => s.backlog)
  const moveInBacklog = useAppStore((s) => s.moveInBacklog)

  const items = backlog.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => !!g)

  const sensors = useSensors(
    // Mouse: arrasta depois de 6px, então cliques em links/botões continuam funcionando.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Toque: segurar 180ms para arrastar; deslizar rápido continua rolando a página.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = backlog.indexOf(String(active.id))
    const to = backlog.indexOf(String(over.id))
    moveInBacklog(from, to)
  }

  const nameOf = (id: string | number) => games.find((g) => g.id === id)?.name ?? 'jogo'
  const positionOf = (id: string | number) => backlog.indexOf(String(id)) + 1

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ListOrdered className="text-ps-light" /> Backlog de platinas
          </h1>
          <p className="mt-1 text-sm text-muted">Arraste os banners para mudar a ordem em que você vai platinar.</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black tabular-nums">{items.length}</span>
          <span className="text-muted">/{BACKLOG_LIMIT}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <ListOrdered className="mx-auto mb-3 text-muted opacity-40" size={40} />
          <p className="text-muted">Seu backlog está vazio.</p>
          <Link to="/desejos" className="btn-primary mt-4">
            <Heart size={16} /> Escolher da lista de desejos
          </Link>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => `Pegou ${nameOf(active.id)}`,
              onDragOver: ({ over }) => (over ? `Sobre a posição ${positionOf(over.id)}` : ''),
              onDragEnd: ({ active, over }) =>
                over ? `${nameOf(active.id)} solto na posição ${positionOf(over.id)}` : `${nameOf(active.id)} solto`,
              onDragCancel: () => 'Reordenação cancelada',
            },
            screenReaderInstructions: {
              draggable: 'Pressione espaço para pegar, use as setas para mover e espaço de novo para soltar.',
            },
          }}
        >
          <SortableContext items={items.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-3">
              {items.map((g, i) => (
                <BacklogBanner key={g.id} game={g} position={i + 1} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {items.length > 0 && items.length < BACKLOG_LIMIT && (
        <p className="text-center text-sm text-muted">
          Ainda cabem {BACKLOG_LIMIT - items.length}.{' '}
          <Link to="/desejos" className="text-ps-light hover:underline">
            Adicionar da lista de desejos
          </Link>
        </p>
      )}
    </div>
  )
}
