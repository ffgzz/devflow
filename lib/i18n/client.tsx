"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_COOKIE,
  translate,
  type Locale,
  type Translator,
} from "./config";

interface I18nContextValue {
  locale: Locale;
  t: Translator;
  setLocale: (locale: Locale) => void;
}

const fallbackContext: I18nContextValue = {
  locale: "en",
  setLocale: () => undefined,
  t: (key, values) => translate("en", key, values),
};

const I18nContext = createContext<I18nContextValue>(fallbackContext);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
