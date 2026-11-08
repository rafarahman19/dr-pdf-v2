"use client";

import React from "react";
import { AlertTriangle, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/use-app-settings";
import type { FriendlyAiError } from "@/hooks/use-ai-client";

interface AiErrorBannerProps {
  error: FriendlyAiError | null;
  onRetryWithDemo?: () => void;
}

export function AiErrorBanner({ error, onRetryWithDemo }: AiErrorBannerProps) {
  const { setSettingsOpen, setDemoMode, t } = useAppSettings();
  if (!error) return null;

  const showKeyActions =
    error.code === "API_KEY_MISSING" ||
    error.code === "QUOTA_EXHAUSTED" ||
    error.code === "INVALID_API_KEY";

  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-amber-500/20 p-2 text-amber-700 dark:text-amber-300 shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <p className="leading-relaxed font-medium">{error.message}</p>
          {showKeyActions && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => setSettingsOpen(true)}
              >
                <KeyRound className="h-4 w-4" />
                {t.errors.openSettings}
              </Button>
              {onRetryWithDemo && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDemoMode(true);
                    onRetryWithDemo();
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  {t.errors.useDemoNow}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
