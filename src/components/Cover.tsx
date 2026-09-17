import { useState } from 'react'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** Capa do jogo com fallback em degradê quando não há imagem ou ela falha. */
export function Cover({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const usable = src && failed !== src

  if (usable) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed(src)}
        className={`object-cover ${className}`}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={`grid place-items-center bg-gradient-to-br from-ps/60 via-surface-2 to-bg text-3xl font-black text-platinum/40 ${className}`}
    >
      {initials(name)}
    </div>
  )
}
