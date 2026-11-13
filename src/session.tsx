import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Config, type User } from './api';
import type { L, Lang } from '../shared/process';

type Session = {
  ready: boolean;
  user: User | null;
  config: Config;
  lang: Lang;
  setLang: (l: Lang) => void;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
  /** Inline translation: t('English', 'Português'). */
  t: (en: string, pt: string) => string;
  /** Translation of a shared {en, pt} label. */
  tl: (l: L | undefined) => string;
};

const Ctx = createContext<Session | null>(null);

function initialLang(): Lang {
  const saved = localStorage.getItem('lang');
  if (saved === 'en' || saved === 'pt') return saved;
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<Config>({ entity: '10x BR', openSignup: true, setupNeeded: false, ai: true });
  const [lang, setLangState] = useState<Lang>(initialLang);

  const refresh = useCallback(async () => {
    const me = await api.get<{ user: User | null; config: Config }>('/auth/me');
    setUser(me.user);
    setConfig(me.config);
    if (me.user && !localStorage.getItem('lang')) setLangState(me.user.lang);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [refresh]);

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  }, [lang]);

  const setLang = useCallback(
    (l: Lang) => {
      localStorage.setItem('lang', l);
      setLangState(l);
      if (user) api.post('/auth/lang', { lang: l }).catch(() => undefined);
    },
    [user],
  );

  const value = useMemo<Session>(
    () => ({
      ready,
      user,
      config,
      lang,
      setLang,
      setUser,
      refresh,
      t: (en, pt) => (lang === 'pt' ? pt : en),
      tl: (l) => (l ? l[lang] : ''),
    }),
    [ready, user, config, lang, setLang, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('SessionProvider missing');
  return s;
}
