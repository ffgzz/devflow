"use client";

import {
  getSelectedPlaygroundProjectId,
  listPlaygroundProjects,
  putPlaygroundProject,
  setSelectedPlaygroundProjectId,
} from "@/lib/playground/indexed-db";
import {
  createProjectId,
  createStarterProject,
  createTemplateFiles,
} from "@/lib/playground/templates";
import type {
  PlaygroundFiles,
  PlaygroundMode,
  PlaygroundProject,
  PlaygroundStorageStatus,
} from "@/lib/playground/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAVE_DEBOUNCE_MS = 400;

const nextForkName = (project: PlaygroundProject, projects: PlaygroundProject[]) => {
  const base = project.name.replace(/\s+\(Fork(?: \d+)?\)$/i, "").trim() || "Untitled";
  const names = new Set(projects.map((item) => item.name));
  if (!names.has(`${base} (Fork)`)) return `${base} (Fork)`;

  let suffix = 2;
  while (names.has(`${base} (Fork ${suffix})`)) suffix += 1;
  return `${base} (Fork ${suffix})`;
};

export const usePlaygroundProjects = () => {
  const [projects, setProjects] = useState<PlaygroundProject[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] =
    useState<PlaygroundStorageStatus>("loading");
  const readyRef = useRef(false);
  const mountedRef = useRef(true);
  const persistenceAvailableRef = useRef(true);
  const currentIdRef = useRef<string | null>(null);
  const saveTimersRef = useRef<Map<string, number>>(new Map());
  const pendingSnapshotsRef = useRef<Map<string, PlaygroundProject>>(new Map());
  const saveGenerationsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listPlaygroundProjects(),
      getSelectedPlaygroundProjectId(),
    ])
      .then(async ([storedProjects, selectedId]) => {
        if (cancelled) return;
        let availableProjects = storedProjects;

        if (availableProjects.length === 0) {
          const starter = createStarterProject();
          availableProjects = [starter];
          await Promise.all([
            putPlaygroundProject(starter),
            setSelectedPlaygroundProjectId(starter.id),
          ]);
        }

        if (cancelled) return;
        const selected =
          selectedId &&
          availableProjects.some((project) => project.id === selectedId)
            ? selectedId
            : availableProjects[0].id;

        setProjects(availableProjects);
        setCurrentId(selected);
        currentIdRef.current = selected;
        readyRef.current = true;
        setStorageStatus("saved");
        if (selected !== selectedId) {
          void setSelectedPlaygroundProjectId(selected).catch(() => {
            persistenceAvailableRef.current = false;
            if (mountedRef.current) setStorageStatus("unavailable");
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        const starter = createStarterProject();
        persistenceAvailableRef.current = false;
        readyRef.current = true;
        setProjects([starter]);
        setCurrentId(starter.id);
        currentIdRef.current = starter.id;
        setStorageStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentId) ?? null,
    [currentId, projects],
  );

  const flushProject = useCallback((projectId: string | null) => {
    if (!projectId || !persistenceAvailableRef.current) return;

    const timer = saveTimersRef.current.get(projectId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimersRef.current.delete(projectId);
    }

    const snapshot = pendingSnapshotsRef.current.get(projectId);
    if (!snapshot) return;
    pendingSnapshotsRef.current.delete(projectId);
    const generation = saveGenerationsRef.current.get(projectId) ?? 0;

    void putPlaygroundProject(snapshot)
      .then(() => {
        if (!mountedRef.current) return;
        const isLatestWrite =
          saveGenerationsRef.current.get(projectId) === generation &&
          !pendingSnapshotsRef.current.has(projectId);
        if (currentIdRef.current === projectId && isLatestWrite) {
          setStorageStatus("saved");
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        persistenceAvailableRef.current = false;
        setStorageStatus("unavailable");
      });
  }, []);

  const scheduleProjectSave = useCallback(
    (project: PlaygroundProject) => {
      if (!persistenceAvailableRef.current) return;
      const previousTimer = saveTimersRef.current.get(project.id);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);

      pendingSnapshotsRef.current.set(project.id, project);
      saveGenerationsRef.current.set(
        project.id,
        (saveGenerationsRef.current.get(project.id) ?? 0) + 1,
      );
      const timer = window.setTimeout(
        () => flushProject(project.id),
        SAVE_DEBOUNCE_MS,
      );
      saveTimersRef.current.set(project.id, timer);
    },
    [flushProject],
  );

  useEffect(() => {
    if (
      !readyRef.current ||
      !currentProject ||
      !persistenceAvailableRef.current
    ) {
      return;
    }

    scheduleProjectSave(currentProject);
  }, [currentProject, scheduleProjectSave]);

  useEffect(() => {
    mountedRef.current = true;
    const flushAllPending = () => {
      for (const projectId of pendingSnapshotsRef.current.keys()) {
        flushProject(projectId);
      }
    };
    window.addEventListener("pagehide", flushAllPending);

    return () => {
      window.removeEventListener("pagehide", flushAllPending);
      flushAllPending();
      mountedRef.current = false;
    };
  }, [flushProject]);

  const updateCurrent = useCallback(
    (updater: (project: PlaygroundProject) => PlaygroundProject) => {
      if (persistenceAvailableRef.current) setStorageStatus("saving");
      setProjects((current) =>
        current.map((project) =>
          project.id === currentId
            ? { ...updater(project), updatedAt: Date.now() }
            : project,
        ),
      );
    },
    [currentId],
  );

  const updateFile = useCallback(
    (file: keyof PlaygroundFiles, value: string) => {
      updateCurrent((project) => ({
        ...project,
        files: { ...project.files, [file]: value },
      }));
    },
    [updateCurrent],
  );

  const renameProject = useCallback(
    (name: string) => {
      updateCurrent((project) => ({ ...project, name: name.slice(0, 60) }));
    },
    [updateCurrent],
  );

  const setMode = useCallback(
    (mode: PlaygroundMode) => {
      updateCurrent((project) => ({ ...project, mode }));
    },
    [updateCurrent],
  );

  const resetProject = useCallback(() => {
    updateCurrent((project) => {
      const template = createTemplateFiles(project.mode);
      return {
        ...project,
        files:
          project.mode === "javascript"
            ? { ...project.files, javascript: template.javascript }
            : {
                ...project.files,
                html: template.html,
                css: template.css,
                webJavascript: template.webJavascript,
              },
      };
    });
  }, [updateCurrent]);

  const selectProject = useCallback(
    (projectId: string) => {
      flushProject(currentIdRef.current);
      currentIdRef.current = projectId;
      setCurrentId(projectId);
      if (!persistenceAvailableRef.current) return;
      setStorageStatus(
        pendingSnapshotsRef.current.has(projectId) ? "saving" : "saved",
      );
      void setSelectedPlaygroundProjectId(projectId).catch(() => {
        persistenceAvailableRef.current = false;
        if (mountedRef.current) setStorageStatus("unavailable");
      });
    },
    [flushProject],
  );

  const forkProject = useCallback((): PlaygroundProject | null => {
    if (!currentProject) return null;
    flushProject(currentProject.id);
    const timestamp = Date.now();
    const fork: PlaygroundProject = {
      ...currentProject,
      id: createProjectId(),
      name: nextForkName(currentProject, projects),
      parentId: currentProject.id,
      files: { ...currentProject.files },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setProjects((current) => [fork, ...current]);
    currentIdRef.current = fork.id;
    setCurrentId(fork.id);
    if (persistenceAvailableRef.current) {
      setStorageStatus("saving");
      scheduleProjectSave(fork);
      void setSelectedPlaygroundProjectId(fork.id).catch(() => {
          persistenceAvailableRef.current = false;
          if (mountedRef.current) setStorageStatus("unavailable");
        });
    }
    return fork;
  }, [currentProject, flushProject, projects, scheduleProjectSave]);

  return {
    projects,
    currentProject,
    storageStatus,
    updateFile,
    renameProject,
    setMode,
    resetProject,
    selectProject,
    forkProject,
  };
};
