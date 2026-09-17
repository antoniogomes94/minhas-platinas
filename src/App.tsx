import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Heart, ListOrdered, Trophy, User } from 'lucide-react'
import { BacklogPage } from './pages/BacklogPage'
import { WishlistPage } from './pages/WishlistPage'
import { GamePage } from './pages/GamePage'
import { ProfilePage } from './pages/ProfilePage'
import { Toaster } from './components/Toaster'
import { usePendingScrapePoller } from './lib/github'
import { useAppStore } from './store/useAppStore'
import { BACKLOG_LIMIT } from './types'

const NAV = [
  { to: '/', label: 'Backlog', icon: ListOrdered, end: true },
  { to: '/desejos', label: 'Desejos', icon: Heart, end: false },
  { to: '/perfil', label: 'Perfil', icon: User, end: false },
]

function Header() {
  const psnId = useAppStore((s) => s.profile.psnId)
  const backlogCount = useAppStore((s) => s.backlog.length)
  const wishCount = useAppStore((s) => s.games.length)

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-platinum to-ps-light text-bg">
            <Trophy size={18} strokeWidth={2.5} />
          </span>
          <span className="hidden sm:inline">Minhas Platinas</span>
        </NavLink>

        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive ? 'bg-ps/20 text-ps-light' : 'text-muted hover:text-ink'
                }`
              }
            >
              <Icon size={16} />
              {label}
              {to === '/' && <span className="text-xs opacity-70">{backlogCount}/{BACKLOG_LIMIT}</span>}
              {to === '/desejos' && <span className="text-xs opacity-70">{wishCount}</span>}
            </NavLink>
          ))}
        </nav>

        {psnId && (
          <span className="ml-auto truncate rounded-full border border-line px-3 py-1 text-xs text-muted sm:ml-2">
            {psnId}
          </span>
        )}
      </div>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-ps-light' : 'text-muted'}`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function App() {
  usePendingScrapePoller()

  return (
    <HashRouter>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:pb-12">
        <Routes>
          <Route path="/" element={<BacklogPage />} />
          <Route path="/desejos" element={<WishlistPage />} />
          <Route path="/jogo/:id" element={<GamePage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="*" element={<BacklogPage />} />
        </Routes>
      </main>
      <BottomNav />
      <Toaster />
    </HashRouter>
  )
}
