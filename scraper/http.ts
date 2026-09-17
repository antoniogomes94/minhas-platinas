const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 minhas-platinas/0.1 (uso pessoal)'

const MIN_INTERVAL_MS = 1000
const TIMEOUT_MS = 20_000
const lastRequestByHost = new Map<string, number>()

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} em ${url}`)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** No máximo 1 requisição por segundo para cada site. */
async function throttle(url: string) {
  const host = new URL(url).host
  const wait = (lastRequestByHost.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestByHost.set(host, Date.now())
}

export async function request(url: string, init: RequestInit = {}, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await throttle(url)
    try {
      const res = await fetch(url, {
        ...init,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8', ...init.headers },
      })
      if (res.status >= 500 && attempt < retries) {
        await sleep(1500 * (attempt + 1))
        continue
      }
      return res
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(1500 * (attempt + 1))
    }
  }
}

export async function fetchText(url: string): Promise<string> {
  const res = await request(url, { headers: { Accept: 'text/html,application/xhtml+xml' } })
  if (!res.ok) throw new HttpError(res.status, url)
  return res.text()
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await request(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new HttpError(res.status, url)
  return (await res.json()) as T
}

/** true se a URL responde 2xx sem redirecionar para outro caminho. */
export async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await request(url, {}, 0)
    await res.body?.cancel()
    return res.ok && new URL(res.url).pathname.replace(/\/$/, '') === new URL(url).pathname.replace(/\/$/, '')
  } catch {
    return false
  }
}
