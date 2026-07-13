"use client";

import { setAnswerAcceptance } from "@/lib/actions/answer.action";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

interface AcceptanceContextValue {
  acceptedAnswerId: string | null;
  canManageAcceptance: boolean;
  pendingAnswerId: string | null;
  updateAcceptance: (answerId: string, accepted: boolean) => Promise<void>;
}

const AcceptanceContext = createContext<AcceptanceContextValue | null>(null);

interface ProviderProps {
  questionId: string;
  initialAcceptedAnswerId: string | null;
  canManageAcceptance: boolean;
  children: ReactNode;
}

export function AnswerAcceptanceProvider({
  questionId,
  initialAcceptedAnswerId,
  canManageAcceptance,
  children,
}: ProviderProps) {
  const [acceptedAnswerId, setAcceptedAnswerId] = useState(
    initialAcceptedAnswerId,
  );
  const [pendingAnswerId, setPendingAnswerId] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (!requestInFlight.current && pendingAnswerId === null) {
      setAcceptedAnswerId(initialAcceptedAnswerId);
    }
  }, [initialAcceptedAnswerId, pendingAnswerId]);

  const updateAcceptance = async (answerId: string, accepted: boolean) => {
    if (!canManageAcceptance || requestInFlight.current) return;

    requestInFlight.current = true;
    const previousAcceptedAnswerId = acceptedAnswerId;
    const optimisticAnswerId = accepted ? answerId : null;

    setPendingAnswerId(answerId);
    // 状态放在整个答案列表的 Provider 中，切换采纳时旧卡片会立即同步取消。
    setAcceptedAnswerId(optimisticAnswerId);

    try {
      const result = await setAnswerAcceptance({
        questionId,
        answerId,
        accepted,
      });

      if (!result.success) {
        setAcceptedAnswerId(previousAcceptedAnswerId);
        toast.error("Failed to update the accepted answer.", {
          description: result.errors?.message || "Please try again later.",
        });
        return;
      }

      setAcceptedAnswerId(
        result.data?.acceptedAnswerId ?? optimisticAnswerId,
      );
      toast.success(
        accepted ? "Answer accepted successfully." : "Acceptance removed.",
      );
    } catch {
      setAcceptedAnswerId(previousAcceptedAnswerId);
      toast.error("Failed to update the accepted answer.", {
        description: "Please try again later.",
      });
    } finally {
      requestInFlight.current = false;
      setPendingAnswerId(null);
    }
  };

  return (
    <AcceptanceContext.Provider
      value={{
        acceptedAnswerId,
        canManageAcceptance,
        pendingAnswerId,
        updateAcceptance,
      }}
    >
      {children}
    </AcceptanceContext.Provider>
  );
}

interface ControlProps {
  answerId: string;
}

export function AnswerAcceptanceControl({ answerId }: ControlProps) {
  const context = useContext(AcceptanceContext);

  if (!context) return null;

  const {
    acceptedAnswerId,
    canManageAcceptance,
    pendingAnswerId,
    updateAcceptance,
  } = context;
  const isAccepted = acceptedAnswerId === answerId;
  const isPending = pendingAnswerId !== null;

  if (!isAccepted && !canManageAcceptance) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {isAccepted && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <span aria-hidden="true">✓</span>
          Accepted answer
        </span>
      )}

      {canManageAcceptance && (
        <button
          type="button"
          aria-pressed={isAccepted}
          disabled={isPending}
          className="rounded-md border border-primary-500 px-3 py-1.5 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500 hover:text-light-900 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void updateAcceptance(answerId, !isAccepted)}
        >
          {pendingAnswerId === answerId
            ? "Updating..."
            : isAccepted
              ? "Unaccept answer"
              : "Accept answer"}
        </button>
      )}
    </div>
  );
}
