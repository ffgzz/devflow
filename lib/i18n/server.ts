import "server-only";

import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  translate,
  type Locale,
  type Translator,
} from "./config";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getI18n(): Promise<{
  locale: Locale;
  t: Translator;
}> {
  const locale = await getLocale();
  return { locale, t: (key, values) => translate(locale, key, values) };
}
