// Canais do YouTube consultados em toda ficha, além dos vídeos embutidos nos guias.
// Para adicionar um canal, use o @handle que aparece na URL do canal (youtube.com/@handle).
export interface Channel {
  name: string
  handle: string
  lang: 'pt' | 'en'
}

export const CHANNELS: Channel[] = [
  { name: 'PowerPyx', handle: 'PowerPyx', lang: 'en' },
  { name: 'Dan Allen Gaming', handle: 'DanAllenGaming', lang: 'en' },
]
