"use client";

export type DraftKind = "question" | "answer";

export interface StoredDraft<T> {
  key: string;
  version: 1;
  userId: string;
  kind: DraftKind;
  resourceId: string;
  data: T;
  updatedAt: number;
}

const DATABASE_NAME = "devflow-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";

let databasePromise: Promise<IDBDatabase> | null = null;

export const buildDraftKey = ({
  userId,
  kind,
  resourceId,
}: {
  userId: string;
  kind: DraftKind;
  resourceId: string;
}) =>
  [userId, kind, resourceId].map((part) => encodeURIComponent(part)).join(":");

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Failed to open draft storage"));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Draft storage upgrade was blocked"));
    };
  });

  return databasePromise;
};

export const getDraft = async <T>(
  key: string,
): Promise<StoredDraft<T> | null> => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => {
      const draft = request.result as StoredDraft<T> | undefined;
      resolve(draft?.version === 1 ? draft : null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read draft"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Draft read was aborted"));
  });
};

export const putDraft = async <T>(draft: StoredDraft<T>): Promise<void> => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(draft);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to save draft"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Draft save was aborted"));
  });
};

export const deleteDraft = async (key: string): Promise<void> => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to delete draft"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Draft deletion was aborted"));
  });
};
