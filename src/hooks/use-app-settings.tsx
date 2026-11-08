"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

const STORAGE_LOCALE_KEY = "drpdf_locale";
const STORAGE_API_KEY = "drpdf_custom_api_key";
const STORAGE_DEMO_KEY = "drpdf_demo_mode";
const SETTINGS_CHANGE_EVENT = "drpdf-settings-change";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface AppSettingsContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (typeof dictionaries)[Locale];
  customApiKey: string;
  setCustomApiKey: (key: string) => void;
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  canInstallPwa: boolean;
  triggerPwaInstall: () => Promise<void>;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function subscribeSettings(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(SETTINGS_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SETTINGS_CHANGE_EVENT, handler);
  };
}

function notifySettingsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
  }
}

function getLocaleSnapshot(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_LOCALE_KEY);
    return saved === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

function getApiKeySnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_API_KEY) ?? "";
  } catch {
    return "";
  }
}

function getDemoSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_DEMO_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribeSettings,
    getLocaleSnapshot,
    () => "id"
  );
  const customApiKey = useSyncExternalStore<string>(
    subscribeSettings,
    getApiKeySnapshot,
    () => ""
  );
  const demoMode = useSyncExternalStore<boolean>(
    subscribeSettings,
    getDemoSnapshot,
    () => false
  );

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((loc: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_LOCALE_KEY, loc);
      notifySettingsChanged();
    } catch {
      // Ignore
    }
  }, []);

  const setCustomApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    try {
      if (trimmed) {
        window.localStorage.setItem(STORAGE_API_KEY, trimmed);
      } else {
        window.localStorage.removeItem(STORAGE_API_KEY);
      }
      notifySettingsChanged();
    } catch {
      // Ignore
    }
  }, []);

  const setDemoMode = useCallback((enabled: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_DEMO_KEY, String(enabled));
      notifySettingsChanged();
    } catch {
      // Ignore
    }
  }, []);

  const triggerPwaInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      locale,
      setLocale,
      t: dictionaries[locale],
      customApiKey,
      setCustomApiKey,
      demoMode,
      setDemoMode,
      canInstallPwa: Boolean(installPrompt),
      triggerPwaInstall,
      settingsOpen,
      setSettingsOpen,
    }),
    [
      locale,
      setLocale,
      customApiKey,
      setCustomApiKey,
      demoMode,
      setDemoMode,
      installPrompt,
      triggerPwaInstall,
      settingsOpen,
    ]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
