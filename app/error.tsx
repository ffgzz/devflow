"use client";

import { reportBoundaryError } from "@/lib/observability/client";
import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function ErrorPage({
  error,
  unstable_retry,
}: ErrorPageProps) {
  const { t } = useI18n();
  useEffect(() => {
    reportBoundaryError(error, "react-boundary");
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <section
        className="background-light900_dark200 light-border w-full max-w-xl rounded-2xl border p-8 text-center shadow-sm"
        aria-labelledby="error-title"
      >
        <p className="small-semibold text-primary-500 mb-3 uppercase tracking-widest">
          {t("Temporary error")}
        </p>
        <h1
          id="error-title"
          className="h2-bold text-dark100_light900 mb-3"
        >
          {t("We could not load this page")}
        </h1>
        <p className="paragraph-regular text-dark400_light700 mx-auto max-w-md">
          {t("The problem may be temporary. Try the request again, or return to the home page.")}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
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
      </section>
    </main>
  );
}
