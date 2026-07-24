"use client";

import { reportBoundaryError } from "@/lib/observability/client";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import "./globals.css";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  translate,
  type Locale,
} from "@/lib/i18n/config";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

const subscribeToLocale = () => () => undefined;
const getBrowserLocale = (): Locale => {
  const stored = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
};

export default function GlobalError({
  error,
  unstable_retry,
}: GlobalErrorProps) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getBrowserLocale,
    () => DEFAULT_LOCALE,
  );
  const t = (key: string) => translate(locale, key);

  useEffect(() => {
    reportBoundaryError(error, "global-boundary");
  }, [error]);

  return (
    <html lang={locale}>
      <body className="background-light900_dark200 text-dark100_light900 flex min-h-screen items-center justify-center px-6">
        <title>{t("Something went wrong")} | DevFlow</title>
        <main className="w-full max-w-lg text-center">
          <p className="small-semibold text-primary-500 mb-3 uppercase tracking-widest">
            DevFlow
          </p>
          <h1 className="h1-bold mb-4">{t("Something went wrong")}</h1>
          <p className="paragraph-regular text-dark400_light700">
            {t("The application could not start correctly. Retry the request or return to the home page.")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="primary-gradient min-h-11 rounded-lg px-5 font-semibold text-white"
            >
              {t("Try again")}
            </button>
            <Link
              href="/"
              className="background-light800_dark300 text-dark300_light900 flex min-h-11 items-center rounded-lg px-5 font-semibold"
            >
              {t("Back to home")}
            </Link>
          </div>
          {error.digest && (
            <p className="small-regular text-dark500_light500 mt-6">
              {t("Reference")}: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
