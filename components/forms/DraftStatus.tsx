"use client";

import type { DraftStatus as Status } from "@/hooks/useIndexedDbDraft";
import { Button } from "../ui/button";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  status: Status;
  pendingUpdatedAt?: number;
  onRestore: () => void;
  onDiscard: () => void | Promise<void>;
}

const DraftStatus = ({
  status,
  pendingUpdatedAt,
  onRestore,
  onDiscard,
}: Props) => {
  const { locale, t } = useI18n();
  if (status === "found" && pendingUpdatedAt) {
    return (
      <div
        role="status"
        className="background-light800_dark200 light-border-2 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="body-semibold text-dark300_light700">
            {t("We found an unfinished draft")}
          </p>
          <p className="small-regular text-dark400_light500">
            {t("Saved {time}. Restoring it will replace the values currently in this form.", {
              time: new Date(pendingUpdatedAt).toLocaleString(locale),
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={onRestore}>
            {t("Restore")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void onDiscard()}
          >
            {t("Discard")}
          </Button>
        </div>
      </div>
    );
  }

  const messages: Partial<Record<Status, string>> = {
    restored: "Draft restored. Changes will continue to save automatically.",
    saving: "Saving draft…",
    saved: "Draft saved on this device.",
    unavailable:
      "Draft storage is unavailable. You can still submit the form normally.",
  };
  const message = messages[status];

  if (!message) return null;

  return (
    <p
      aria-live="polite"
      className="small-regular text-dark400_light500"
    >
      {t(message)}
    </p>
  );
};

export default DraftStatus;
