import { t } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Empty component
export function Empty() {
  useLocale();
  return (
    <div className={cn("flex h-full items-center justify-center")} onClick={() => toast(t("Coming soon"))}>{t("Empty")}</div>
  );
}