import { saveSession, sessionStore } from '../store/session';
import type { Session } from './types';

const BASE = '/api/';
/** Демо без сервера (npm run preview:static): данные из снимка каталога, корзина и заказы — в браузере (api/demo.ts). */
const DEMO = import.meta.env.VITE_DEMO === '1';

export const NETWORK_ERROR = 'Проверьте соединение с интернетом и попробуйте еще раз.';
export const GENERIC_ERROR = 'Произошла ошибка, повторите позже.';

export class ApiError extends Error {
  status: number;
  codes: string[];
  constructor(status: number, message: string, codes: string[] = []) {
    super(message);
    this.status = status;
    this.codes = codes;
  }
}

function systemName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/mac os/i.test(ua)) return 'macos';
  if (/linux/i.test(ua)) return 'linux';
  return 'windows';
}

// Заголовки повторяют старое веб-приложение (контракт с бэкендом).
function headers(token?: string): Record<string, string> {
  const s = sessionStore.get().session;
  const h: Record<string, string> = {
    'content-type': 'application/json',
    package: 'lite_pack',
    system: systemName(),
    'app-type': 'web',
    'client-id': s?.clientId ?? '',
    locale: 'ru-RU',
    'system-version': '',
    version: '1.0.18',
    'build-number': '70',
  };
  if (token) h.authorization = 'Bearer ' + token;
  return h;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const q = qs.toString();
  return BASE + path + (q ? '?' + q : '');
}

async function toError(res: Response): Promise<ApiError> {
  let message = GENERIC_ERROR;
  let codes: string[] = [];
  try {
    const j = await res.json();
    if (j?.message && typeof j.message === 'string' && /[а-яё]/i.test(j.message)) message = j.message;
    if (Array.isArray(j?.errors)) codes = j.errors.map((e: { message?: string }) => e?.message ?? '').filter(Boolean);
  } catch {
    /* тело не JSON */
  }
  return new ApiError(res.status, message, codes);
}

let signupPromise: Promise<Session> | null = null;

/** Запросы, запущенные заранее из index.html (ранний старт), — подхватываем один раз. */
type BootWindow = Window & {
  __lpSignup?: Promise<{ accessToken: string; clientId: string | null; profileId: string; profileKind: string }>;
  __lpPre?: Record<string, Promise<unknown>>;
};
const bootWindow = () => (typeof window !== 'undefined' ? (window as BootWindow) : undefined);

/** Анонимный профиль — как в старом приложении: каждому посетителю свой токен. */
export function signupAnonymous(): Promise<Session> {
  if (DEMO) {
    const s: Session = sessionStore.get().session ?? { accessToken: 'demo', clientId: 'demo', profileId: 'demo-anon', profileKind: 'anonym' };
    saveSession(s);
    return Promise.resolve(s);
  }
  if (signupPromise) return signupPromise;
  const prev = sessionStore.get().session;
  const w = bootWindow();
  const early = w?.__lpSignup;
  if (w) w.__lpSignup = undefined;
  const request = () =>
    fetch(buildUrl('v1/auth/signupAnonymous'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ appId: 'lite_pack', clientId: prev?.clientId ?? null, appType: 'shop' }),
    }).then(async (r) => {
      if (!r.ok) throw await toError(r);
      return r.json();
    });
  signupPromise = (early ? early.catch(request) : request())
    .then((j) => {
      const s: Session = { accessToken: j.accessToken, clientId: j.clientId ?? null, profileId: j.profileId, profileKind: (j.profileKind as Session['profileKind']) ?? 'anonym' };
      saveSession(s);
      return s;
    })
    .finally(() => {
      signupPromise = null;
    });
  return signupPromise;
}

async function token(): Promise<string> {
  const s = sessionStore.get().session;
  if (s?.accessToken) return s.accessToken;
  return (await signupAnonymous()).accessToken;
}

const authLostListeners = new Set<() => void>();
export const onAuthLost = (fn: () => void) => {
  authLostListeners.add(fn);
  return () => authLostListeners.delete(fn);
};

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<T> {
  if (DEMO) {
    const { demoApi } = await import('./demo');
    return demoApi<T>(method, path, opts);
  }
  const url = buildUrl(path, opts.query);
  const pre = method === 'GET' ? bootWindow()?.__lpPre?.[url] : undefined;
  if (pre) {
    delete bootWindow()!.__lpPre![url];
    try {
      return (await pre) as T;
    } catch {
      /* ранний запрос не удался — повторяем обычным путём */
    }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const t = await token();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: headers(t),
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: opts.signal,
      });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new ApiError(0, NETWORK_ERROR);
    }
    if (res.status === 401 && attempt === 0) {
      const wasAuthorized = sessionStore.get().session?.profileKind !== 'anonym';
      saveSession(null);
      if (wasAuthorized) authLostListeners.forEach((fn) => fn());
      continue;
    }
    if (!res.ok) throw await toError(res);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  throw new ApiError(401, GENERIC_ERROR);
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : GENERIC_ERROR);
