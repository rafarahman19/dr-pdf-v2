import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, locale: "id" | "en" = "id"): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US").format(n);
}

export function formatRelativeDate(timestamp: number, locale: "id" | "en" = "id"): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~3.8 characters per token for Indonesian/English academic prose
  return Math.max(1, Math.ceil(text.length / 3.8));
}

export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
