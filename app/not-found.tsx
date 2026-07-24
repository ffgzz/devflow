import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[60vh] items-center justify-center px-6 py-16 outline-none"
    >
      <section className="w-full max-w-xl text-center" aria-labelledby="title">
        <p className="font-space-grotesk text-primary-500 text-8xl font-bold">
          404
        </p>
        <h1 id="title" className="h2-bold text-dark100_light900 mt-4">
          {t("Page not found")}
        </h1>
        <p className="paragraph-regular text-dark400_light700 mx-auto mt-3 max-w-md">
          {t("The page may have moved, been deleted, or never existed.")}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="primary-gradient flex min-h-11 items-center rounded-lg px-5 font-semibold text-white"
          >
            {t("Explore questions")}
          </Link>
          <Link
            href="/ask-question"
            className="background-light800_dark300 text-dark300_light900 flex min-h-11 items-center rounded-lg px-5 font-semibold"
          >
            {t("Ask a question")}
          </Link>
        </div>
      </section>
    </main>
  );
}
