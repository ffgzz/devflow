"use client";

import { WEB_STARTER_JAVASCRIPT } from "./templates";
import type { PlaygroundProject } from "./types";

const DATABASE_NAME = "devflow-playground";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";
const META_STORE = "meta";
const SELECTED_PROJECT_KEY = "selected-project";

let databasePromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const projects = database.createObjectStore(PROJECT_STORE, {
          keyPath: "id",
        });
        projects.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
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
      reject(request.error ?? new Error("Failed to open playground storage"));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Playground storage upgrade was blocked"));
    };
  });

  return databasePromise;
};

const normalizeProject = (value: unknown): PlaygroundProject | null => {
  if (!value || typeof value !== "object") return null;
  const project = value as Partial<PlaygroundProject>;
  const isValid =
    project.version === 1 &&
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    (project.mode === "javascript" || project.mode === "web") &&
    typeof project.files?.javascript === "string" &&
    typeof project.files?.html === "string" &&
    typeof project.files?.css === "string" &&
    typeof project.createdAt === "number" &&
    typeof project.updatedAt === "number";

  if (!isValid || !project.files) return null;
  return {
    ...(project as PlaygroundProject),
    files: {
      ...project.files,
      webJavascript:
        typeof project.files.webJavascript === "string"
          ? project.files.webJavascript
          : project.mode === "web"
            ? project.files.javascript
            : WEB_STARTER_JAVASCRIPT,
    },
  };
};

export const listPlaygroundProjects = async (): Promise<
  PlaygroundProject[]
> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const request = transaction.objectStore(PROJECT_STORE).getAll();
    request.onsuccess = () => {
      const projects = (request.result as unknown[])
        .map(normalizeProject)
        .filter((project): project is PlaygroundProject => project !== null)
        .sort((left, right) => right.updatedAt - left.updatedAt);
      resolve(projects);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read playground projects"));
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Playground project read was aborted"),
      );
  });
};

export const putPlaygroundProject = async (
  project: PlaygroundProject,
): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).put(project);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to save playground project"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Playground save was aborted"));
  });
};

export const getSelectedPlaygroundProjectId = async (): Promise<
  string | null
> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(META_STORE, "readonly");
    const request = transaction.objectStore(META_STORE).get(SELECTED_PROJECT_KEY);
    request.onsuccess = () => {
      const value = request.result as { key: string; value?: unknown } | undefined;
      resolve(typeof value?.value === "string" ? value.value : null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read playground selection"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Playground selection read aborted"));
  });
};

export const setSelectedPlaygroundProjectId = async (
  projectId: string,
): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put({
      key: SELECTED_PROJECT_KEY,
      value: projectId,
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to save playground selection"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Playground selection save aborted"));
  });
};
