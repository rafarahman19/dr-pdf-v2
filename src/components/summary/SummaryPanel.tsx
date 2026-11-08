"use client";

import React, { useCallback, useState } from "react";
import {
  AlignLeft,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiErrorBanner } from "@/components/ui/ai-error-banner";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ExportMenu } from "@/components/export/ExportMenu";
import type { SummaryMode } from "@/lib/ai/schemas";
import type { StoredDocument } from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useAiClient, type FriendlyAiError } from "@/hooks/use-ai-client";

interface SummaryPanelProps {
  doc: StoredDocument;
  onUpdateDocument: (updated: StoredDocument) => Promise<void>;
}

const SUMMARY_MODES: Array<{
  key: SummaryMode;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "paragraph", icon: AlignLeft },
  { key: "bullets", icon: ListChecks },
  { key: "table", icon: Table2 },
  { key: "analogy", icon: Lightbulb },
];

export function SummaryPanel({ doc, onUpdateDocument }: SummaryPanelProps) {
  const { locale, t } = useAppSettings();
  const { postStream } = useAiClient();

  const [mode, setMode] = useState<SummaryMode>(
    doc.summary?.mode ?? "bullets"
  );
  const [extraInstructions, setExtraInstructions] = useState<string>(
    doc.summary?.extraInstructions ?? ""
  );
  const [streamingMd, setStreamingMd] = useState<string>(
    doc.summary?.markdown ?? ""
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<FriendlyAiError | null>(null);

  const runGenerate = useCallback(
    async (forceDemo = false) => {
      setError(null);
      setIsGenerating(true);
      setStreamingMd("");

      try {
        const finalMd = await postStream(
          "/api/ai/summary",
          {
            documentTitle: doc.title,
            pages: doc.pages,
            mode,
            extraInstructions,
            locale,
          },
          (partial) => {
            setStreamingMd(partial);
          },
          { forceDemo }
        );

        await onUpdateDocument({
          ...doc,
          summary: {
            mode,
            extraInstructions,
            markdown: finalMd,
            generatedAt: Date.now(),
          },
        });
      } catch (err) {
        setError(err as FriendlyAiError);
      } finally {
        setIsGenerating(false);
      }
    },
    [doc, extraInstructions, locale, mode, onUpdateDocument, postStream]
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary shrink-0" />
                {t.summary.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {t.summary.subtitle}
              </CardDescription>
            </div>
            <ExportMenu doc={doc} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 4 Format Mode Cards */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.summary.modeLabel}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUMMARY_MODES.map(({ key, icon: Icon }) => {
                const selected = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    aria-pressed={selected}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all min-h-[60px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-accent text-foreground shadow-2xs ring-1 ring-primary/30"
                        : "border-border bg-background/60 hover:bg-muted/70 text-foreground"
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 shrink-0 ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-snug">
                        {t.summary.modes[key]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {t.summary.modeDesc[key]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free-text Extra Instructions */}
          <div className="space-y-1.5">
            <label
              htmlFor="summary-extra-input"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {t.summary.extraLabel}
            </label>
            <textarea
              id="summary-extra-input"
              rows={2}
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder={t.summary.extraPlaceholder}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          <Button
            type="button"
            size="lg"
            disabled={isGenerating}
            onClick={() => void runGenerate(false)}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t.summary.streaming}
              </>
            ) : streamingMd ? (
              <>
                <RefreshCw className="h-4 w-4" />
                {t.summary.regenerateBtn}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {t.summary.generateBtn}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AiErrorBanner error={error} onRetryWithDemo={() => void runGenerate(true)} />

      {/* Streaming Skeleton when starting */}
      {isGenerating && !streamingMd && (
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-3">
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-24 w-full mt-2" />
          </CardContent>
        </Card>
      )}

      {/* Rendered Markdown Result */}
      {streamingMd ? (
        <Card>
          <CardContent className="p-5 sm:p-7">
            <MarkdownRenderer content={streamingMd} />
          </CardContent>
        </Card>
      ) : (
        !isGenerating &&
        !error && (
          <Card className="border-dashed">
            <CardContent className="py-12 px-5 text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <AlignLeft className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold">{t.summary.emptyTitle}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t.summary.emptyDesc}
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
