"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import GlobalResult from "@/components/GlobalResult";
import { Input } from "@/components/ui/input";
import type {
  GlobalSearchItem,
  GlobalSearchResult,
  GlobalSearchType,
} from "@/lib/dal/global-search";

interface SearchAPIResponse {
  success: boolean;
  data?: GlobalSearchResult;
  error?: { message?: string };
}

const GlobalSearch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const requestSequenceRef = useRef(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<GlobalSearchType | null>(null);
  const [items, setItems] = useState<GlobalSearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedSearch = search.trim();

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, []);

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointer);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const sequence = ++requestSequenceRef.current;

    if (trimmedSearch.length < 2) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setActiveIndex(-1);

    const debounceTimer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: trimmedSearch });
      if (type) params.set("type", type);

      try {
        const response = await fetch(`/api/search?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchAPIResponse;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "Search is unavailable.");
        }

        // AbortController stops most stale requests. The sequence check also
        // protects against a response that completed at the same moment it was
        // cancelled, so old text can never overwrite new search results.
        if (sequence !== requestSequenceRef.current) return;

        setItems(payload.data.items);
        setActiveIndex(payload.data.items.length > 0 ? 0 : -1);
      } catch (requestError) {
        if (
          controller.signal.aborted ||
          sequence !== requestSequenceRef.current
        ) {
          return;
        }

        setItems([]);
        setActiveIndex(-1);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Search is unavailable.",
        );
      } finally {
        if (sequence === requestSequenceRef.current) setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [trimmedSearch, type]);

  const selectResult = (item: GlobalSearchItem) => {
    setIsOpen(false);
    router.push(item.href);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? items.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectResult(items[activeIndex]);
    }
  };

  return (
    <div
      className="relative w-full max-w-[600px] max-lg:hidden"
      ref={searchContainerRef}
    >
      <div className="background-light800_darkgradient relative flex min-h-[56px] grow items-center gap-1 rounded-xl px-4">
        <button
          type="button"
          aria-label="Focus global search"
          onClick={() => inputRef.current?.focus()}
        >
          <Image
            src="/icons/search.svg"
            alt=""
            width={24}
            height={24}
            aria-hidden="true"
          />
        </button>

        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Global search"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          placeholder="Search anything…  ⌘K"
          value={search}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          className="paragraph-regular no-focus placeholder text-dark400_light700 border-none shadow-none outline-none"
        />
      </div>

      {isOpen && (
        <GlobalResult
          listboxId={listboxId}
          query={trimmedSearch}
          type={type}
          items={items}
          isLoading={isLoading}
          error={error}
          activeIndex={activeIndex}
          onTypeChange={(nextType) => {
            setType(nextType);
            setActiveIndex(-1);
            inputRef.current?.focus();
          }}
          onActiveIndexChange={setActiveIndex}
          onSelect={selectResult}
        />
      )}
    </div>
  );
};

export default GlobalSearch;
