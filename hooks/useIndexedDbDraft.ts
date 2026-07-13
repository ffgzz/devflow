"use client";

import {
  buildDraftKey,
  deleteDraft,
  getDraft,
  putDraft,
} from "@/lib/drafts/indexed-db";
import type {
  DraftKind,
  StoredDraft,
} from "@/lib/drafts/indexed-db";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DraftStatus =
  | "loading"
  | "idle"
  | "found"
  | "restored"
  | "saving"
  | "saved"
  | "unavailable";

interface UseIndexedDbDraftOptions<T> {
  userId?: string;
  kind: DraftKind;
  resourceId: string;
  data: T;
  enabled: boolean;
  shouldPersist: boolean;
  debounceMs?: number;
}

const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const useIndexedDbDraft = <T>({
  userId,
  kind,
  resourceId,
  data,
  enabled,
  shouldPersist,
  debounceMs = 800,
}: UseIndexedDbDraftOptions<T>) => {
  const key = useMemo(
    () =>
      userId ? buildDraftKey({ userId, kind, resourceId }) : undefined,
    [kind, resourceId, userId],
  );
  const serializedData = useMemo(() => JSON.stringify(data), [data]);
  const [status, setStatus] = useState<DraftStatus>(
    key ? "loading" : "idle",
  );
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<T> | null>(
    null,
  );
  const [readyToSave, setReadyToSave] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const storageAvailableRef = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    lastPersistedRef.current = null;
    storageAvailableRef.current = true;
    setPendingDraft(null);
    setReadyToSave(false);

    if (!key) {
      setStatus("idle");
      return;
    }

    setStatus("loading");
    void getDraft<T>(key)
      .then(async (draft) => {
        if (!mountedRef.current || generationRef.current !== generation) return;

        if (draft && Date.now() - draft.updatedAt > MAX_DRAFT_AGE_MS) {
          await deleteDraft(key);
          draft = null;
        }

        if (!mountedRef.current || generationRef.current !== generation) return;
        if (draft) {
          lastPersistedRef.current = JSON.stringify(draft.data);
          setPendingDraft(draft);
          setStatus("found");
          return;
        }

        setReadyToSave(true);
        setStatus("idle");
      })
      .catch(() => {
        if (!mountedRef.current || generationRef.current !== generation) return;
        storageAvailableRef.current = false;
        setReadyToSave(true);
        setStatus("unavailable");
      });
  }, [key]);

  useEffect(() => {
    if (
      !key ||
      !userId ||
      !enabled ||
      !readyToSave ||
      !storageAvailableRef.current ||
      (shouldPersist && serializedData === lastPersistedRef.current)
    ) {
      return;
    }

    const generation = generationRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (generationRef.current !== generation) return;

      if (!shouldPersist) {
        // Always enqueue the delete, even when no completed write is known.
        // An older IndexedDB put may already be in flight; read/write
        // transactions are ordered, so this later delete wins that race.
        void deleteDraft(key)
          .then(() => {
            if (!mountedRef.current || generationRef.current !== generation)
              return;
            lastPersistedRef.current = null;
            setStatus("idle");
          })
          .catch(() => {
            if (!mountedRef.current || generationRef.current !== generation)
              return;
            storageAvailableRef.current = false;
            setStatus("unavailable");
          });
        return;
      }

      setStatus("saving");
      void putDraft({
        key,
        version: 1,
        userId,
        kind,
        resourceId,
        data,
        updatedAt: Date.now(),
      })
        .then(() => {
          if (!mountedRef.current || generationRef.current !== generation)
            return;
          lastPersistedRef.current = serializedData;
          setStatus("saved");
        })
        .catch(() => {
          if (!mountedRef.current || generationRef.current !== generation)
            return;
          storageAvailableRef.current = false;
          setStatus("unavailable");
        });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [
    data,
    debounceMs,
    enabled,
    key,
    kind,
    readyToSave,
    resourceId,
    serializedData,
    shouldPersist,
    userId,
  ]);

  const restoreDraft = useCallback((): T | null => {
    if (!pendingDraft) return null;
    lastPersistedRef.current = JSON.stringify(pendingDraft.data);
    setPendingDraft(null);
    setReadyToSave(true);
    setStatus("restored");
    return pendingDraft.data;
  }, [pendingDraft]);

  const discardDraft = useCallback(async (): Promise<void> => {
    if (!key) return;
    const generation = ++generationRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    lastPersistedRef.current = null;
    setPendingDraft(null);

    try {
      await deleteDraft(key);
      if (!mountedRef.current || generationRef.current !== generation) return;
      setStatus("idle");
    } catch {
      if (!mountedRef.current || generationRef.current !== generation) return;
      storageAvailableRef.current = false;
      setStatus("unavailable");
    } finally {
      if (mountedRef.current && generationRef.current === generation) {
        setReadyToSave(true);
      }
    }
  }, [key]);

  const clearDraft = useCallback(
    async (options: { resume?: boolean } = {}): Promise<void> => {
      // Draft persistence is progressive enhancement. A storage failure must
      // never delay or block a successful form submission.
      if (!key || !storageAvailableRef.current) return;
      const generation = ++generationRef.current;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      lastPersistedRef.current = null;
      setPendingDraft(null);
      // Pause before deleting so a render with old values cannot recreate the
      // draft while reset or navigation is in progress.
      setReadyToSave(false);

      try {
        await deleteDraft(key);
        if (mountedRef.current && generationRef.current === generation) {
          setStatus("idle");
          setReadyToSave(Boolean(options.resume));
        }
      } catch {
        if (mountedRef.current && generationRef.current === generation) {
          storageAvailableRef.current = false;
          setStatus("unavailable");
        }
      }
    },
    [key],
  );

  return {
    status,
    pendingDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
};
