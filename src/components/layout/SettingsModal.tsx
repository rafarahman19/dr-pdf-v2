"use client";

import React, { useState } from "react";
import { useTheme } from "next-themes";
import {
  Check,
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Laptop,
  Moon,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/use-app-settings";

function SettingsFormContent() {
  const {
    locale,
    setLocale,
    t,
    customApiKey,
    setCustomApiKey,
    demoMode,
    setDemoMode,
    canInstallPwa,
    triggerPwaInstall,
  } = useAppSettings();
  const { theme, setTheme } = useTheme();

  const [keyDraft, setKeyDraft] = useState(customApiKey);
  const [showKey, setShowKey] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiKey(keyDraft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-5">
      {/* BYOK Fallback Input */}
      <div className="space-y-2">
        <label
          htmlFor="custom-gemini-key"
          className="block text-sm font-semibold text-foreground"
        >
          {t.settings.apiKeyLabel}
        </label>
        <div className="relative flex items-center">
          <input
            id="custom-gemini-key"
            type={showKey ? "text" : "password"}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={t.settings.apiKeyPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            aria-label={showKey ? "Hide API key" : "Show API key"}
            className="absolute right-1 inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t.settings.apiKeyHelp}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" size="sm">
            {savedNotice ? (
              <>
                <Check className="h-4 w-4" />
                {t.settings.savedToast}
              </>
            ) : (
              t.settings.saveKeyBtn
            )}
          </Button>
          {customApiKey && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setKeyDraft("");
                setCustomApiKey("");
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t.settings.clearKeyBtn}
            </Button>
          )}
        </div>
      </div>

      {/* Smart Simulation Mode Toggle */}
      <div className="rounded-xl border border-border bg-muted/50 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {t.settings.demoModeLabel}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.settings.demoModeDesc}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={demoMode}
            aria-label={t.settings.demoModeLabel}
            onClick={() => setDemoMode(!demoMode)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              demoMode ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                demoMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Globe className="h-4 w-4 text-primary" />
          {t.settings.languageLabel}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={locale === "id" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("id")}
          >
            Bahasa Indonesia
          </Button>
          <Button
            type="button"
            variant={locale === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("en")}
          >
            English
          </Button>
        </div>
      </div>

      {/* Theme Selector */}
      <div className="space-y-2">
        <span className="block text-sm font-semibold">{t.settings.themeLabel}</span>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant={theme === "system" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("system")}
          >
            <Laptop className="h-4 w-4" />
            {t.settings.themes.system}
          </Button>
          <Button
            type="button"
            variant={theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
          >
            <Sun className="h-4 w-4" />
            {t.settings.themes.light}
          </Button>
          <Button
            type="button"
            variant={theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-4 w-4" />
            {t.settings.themes.dark}
          </Button>
        </div>
      </div>

      {/* PWA Install Banner if supported */}
      {canInstallPwa && (
        <div className="rounded-xl border border-primary/30 bg-accent p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-accent-foreground">
                {t.settings.pwaInstallTitle}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.settings.pwaInstallDesc}
              </p>
            </div>
            <Button type="button" size="sm" onClick={triggerPwaInstall}>
              <Download className="h-4 w-4" />
              {t.settings.pwaInstallBtn}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

export function SettingsModal() {
  const { t, customApiKey, settingsOpen, setSettingsOpen } = useAppSettings();

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t.settings.title}
          </DialogTitle>
          <DialogDescription>{t.settings.subtitle}</DialogDescription>
        </DialogHeader>
        {settingsOpen && <SettingsFormContent key={customApiKey || "empty"} />}
      </DialogContent>
    </Dialog>
  );
}
