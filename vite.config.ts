import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// No GitHub Actions o nome do repositório define o caminho do Pages (usuario.github.io/<repo>/).
// Um repositório "usuario.github.io" é servido na raiz.
function pagesBase(): string {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo) return '/minhas-platinas/'
  return repo.endsWith('.github.io') ? '/' : `/${repo}/`
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'scraper/**/*.test.ts'],
  },
})
