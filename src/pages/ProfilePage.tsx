import { useRef, useState, type FormEvent } from 'react'
import { Download, ExternalLink, KeyRound, Save, ShieldAlert, Upload, User } from 'lucide-react'
import { selectPersisted, useAppStore } from '../store/useAppStore'
import { toast } from '../store/useToastStore'
import { backupFileName, createBackup, parseBackup } from '../store/backup'
import { actionsUrl } from '../lib/github'
import type { PersistedState, Profile, Settings } from '../types'

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Icon size={18} className="text-ps-light" /> {title}
      </h2>
      {children}
    </section>
  )
}

function ProfileForm() {
  const profile = useAppStore((s) => s.profile)
  const setProfile = useAppStore((s) => s.setProfile)
  const [draft, setDraft] = useState<Profile>(profile)

  function submit(e: FormEvent) {
    e.preventDefault()
    setProfile({ name: draft.name.trim(), email: draft.email.trim(), psnId: draft.psnId.trim() })
    toast('Perfil salvo.', 'success')
  }

  const field = (key: keyof Profile, label: string, type = 'text', placeholder = '') => (
    <div>
      <label htmlFor={`profile-${key}`} className="label">
        {label}
      </label>
      <input
        id={`profile-${key}`}
        type={type}
        className="input"
        placeholder={placeholder}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
      {field('name', 'Nome', 'text', 'Seu nome')}
      {field('email', 'E-mail', 'email', 'voce@exemplo.com')}
      {field('psnId', 'ID da PSN', 'text', 'Seu_ID_PSN')}
      <div className="sm:col-span-3">
        <button type="submit" className="btn-primary">
          <Save size={16} /> Salvar perfil
        </button>
      </div>
    </form>
  )
}

function GithubForm() {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const [draft, setDraft] = useState<Settings>(settings)
  const [showToken, setShowToken] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    setSettings({
      githubOwner: draft.githubOwner.trim(),
      githubRepo: draft.githubRepo.trim(),
      githubToken: draft.githubToken?.trim() || undefined,
    })
    toast('Configuração do GitHub salva.', 'success')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">
        A busca de dados roda no GitHub Actions do seu repositório. O app precisa de um{' '}
        <a
          href="https://github.com/settings/personal-access-tokens/new"
          target="_blank"
          rel="noreferrer"
          className="text-ps-light hover:underline"
        >
          token fine-grained
        </a>{' '}
        com acesso <strong>só a este repositório</strong> e a permissão <code className="text-ink">Actions: Read and write</code>.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gh-owner" className="label">
            Usuário do GitHub
          </label>
          <input
            id="gh-owner"
            className="input"
            placeholder="seu-usuario"
            value={draft.githubOwner}
            onChange={(e) => setDraft({ ...draft, githubOwner: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="gh-repo" className="label">
            Repositório
          </label>
          <input
            id="gh-repo"
            className="input"
            value={draft.githubRepo}
            onChange={(e) => setDraft({ ...draft, githubRepo: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="gh-token" className="label">
            Token
          </label>
          <div className="flex gap-2">
            <input
              id="gh-token"
              type={showToken ? 'text' : 'password'}
              className="input font-mono"
              placeholder="github_pat_…"
              autoComplete="off"
              value={draft.githubToken ?? ''}
              onChange={(e) => setDraft({ ...draft, githubToken: e.target.value })}
            />
            <button type="button" className="btn-ghost shrink-0" onClick={() => setShowToken((v) => !v)}>
              {showToken ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
        <ShieldAlert size={16} className="mt-px shrink-0" />
        <span>
          O token fica salvo apenas neste navegador. Qualquer outro site seu publicado em{' '}
          <code>{draft.githubOwner || 'usuario'}.github.io</code> consegue lê-lo, por isso restrinja o token a este
          repositório.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          <Save size={16} /> Salvar configuração
        </button>
        {settings.githubOwner && settings.githubRepo && (
          <a href={actionsUrl(settings)} target="_blank" rel="noreferrer" className="btn-ghost">
            <ExternalLink size={16} /> Ver execuções no GitHub
          </a>
        )}
      </div>
    </form>
  )
}

function BackupSection() {
  const [includeToken, setIncludeToken] = useState(false)
  const [pending, setPending] = useState<{ data: PersistedState; exportedAt: string; fileName: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const replaceAll = useAppStore((s) => s.replaceAll)

  function exportBackup() {
    const text = createBackup(selectPersisted(useAppStore.getState()), includeToken)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    a.click()
    URL.revokeObjectURL(url)
    toast('Backup exportado.', 'success')
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const result = parseBackup(await file.text())
    if (fileInput.current) fileInput.current.value = ''
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    setPending({ data: result.data, exportedAt: result.exportedAt, fileName: file.name })
  }

  function confirmImport() {
    if (!pending) return
    const current = useAppStore.getState().settings
    const data = pending.data
    // Mantém o token atual se o backup não trouxer um.
    replaceAll({ ...data, settings: { ...data.settings, githubToken: data.settings.githubToken ?? current.githubToken } })
    setPending(null)
    toast('Backup importado.', 'success')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Seus dados ficam no <code className="text-ink">localStorage</code> deste navegador. Exporte um arquivo de vez em
        quando: limpar os dados do site apaga tudo.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={exportBackup}>
          <Download size={16} /> Exportar backup
        </button>
        <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
          <Upload size={16} /> Importar backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Arquivo de backup"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="accent-ps"
            checked={includeToken}
            onChange={(e) => setIncludeToken(e.target.checked)}
          />
          Incluir o token do GitHub
        </label>
      </div>

      {pending && (
        <div role="alertdialog" aria-label="Confirmar importação" className="rounded-xl border border-warn/40 bg-warn/5 p-4">
          <p className="text-sm">
            <strong>{pending.fileName}</strong>, exportado em {new Date(pending.exportedAt).toLocaleString('pt-BR')}:{' '}
            {pending.data.games.length} jogo(s), {pending.data.backlog.length} no backlog, perfil de{' '}
            {pending.data.profile.name || 'sem nome'}.
          </p>
          <p className="mt-1 text-sm text-warn">Isso substitui todos os dados atuais deste navegador.</p>
          <div className="mt-3 flex gap-2">
            <button className="btn-danger" onClick={confirmImport}>
              Substituir dados
            </button>
            <button className="btn-ghost" onClick={() => setPending(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <User className="text-ps-light" /> Perfil
      </h1>
      <Section title="Seus dados" icon={User}>
        <ProfileForm />
      </Section>
      <Section title="Backup" icon={Download}>
        <BackupSection />
      </Section>
      <Section title="GitHub (busca de dados)" icon={KeyRound}>
        <GithubForm />
      </Section>
    </div>
  )
}
