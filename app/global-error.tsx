"use client";

import Link from "next/link";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({
  error,
  unstable_retry,
}: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="background-light900_dark200 text-dark100_light900 flex min-h-screen items-center justify-center px-6">
        <title>Something went wrong | DevFlow</title>
        <main className="w-full max-w-lg text-center">
          <p className="small-semibold text-primary-500 mb-3 uppercase tracking-widest">
            DevFlow
          </p>
          <h1 className="h1-bold mb-4">Something went wrong</h1>
          <p className="paragraph-regular text-dark400_light700">
            The application could not start correctly. Retry the request or
            return to the home page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="primary-gradient min-h-11 rounded-lg px-5 font-semibold text-white"
            >
              Try again
            </button>
            <Link
              href="/"
              className="background-light800_dark300 text-dark300_light900 flex min-h-11 items-center rounded-lg px-5 font-semibold"
            >
              Back to home
            </Link>
          </div>
          {error.digest && (
            <p className="small-regular text-dark500_light500 mt-6">
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
