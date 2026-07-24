"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";

const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("Switch language")}
          title={t("Language")}
        >
          <Languages aria-hidden="true" className="size-[1.2rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLocale("zh-CN")}
          aria-current={locale === "zh-CN" ? "true" : undefined}
        >
          中文{locale === "zh-CN" ? " ✓" : ""}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale("en")}
          aria-current={locale === "en" ? "true" : undefined}
        >
          English{locale === "en" ? " ✓" : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
