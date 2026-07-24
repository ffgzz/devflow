const LoadingBar = ({ className }: { className: string }) => (
  <div
    className={`background-light800_dark300 animate-pulse rounded-md motion-reduce:animate-none ${className}`}
  />
);

import { getI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <main
      className="mx-auto w-full max-w-5xl px-6 py-12"
      aria-busy="true"
      aria-label={t("Loading page")}
    >
      <span className="sr-only">{t("Loading page")}</span>
      <LoadingBar className="h-10 w-2/3 max-w-xl" />
      <LoadingBar className="mt-5 h-14 w-full" />

      <div className="mt-10 space-y-6">
        {[0, 1, 2].map((item) => (
          <section
            key={item}
            className="background-light900_dark200 light-border rounded-xl border p-6"
          >
            <LoadingBar className="h-6 w-3/4" />
            <LoadingBar className="mt-4 h-4 w-full" />
            <LoadingBar className="mt-2 h-4 w-5/6" />
            <div className="mt-5 flex gap-3">
              <LoadingBar className="h-7 w-20" />
              <LoadingBar className="h-7 w-24" />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
