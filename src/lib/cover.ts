import type { Game, GameInfo } from '../types'

/** Capa manual → imagem do RAWG (cadastro) → capa coletada dos sites. */
export function coverOf(game: Game, info: GameInfo | null | undefined): string | null {
  return game.coverUrl || game.catalog?.image || info?.cover || null
}
