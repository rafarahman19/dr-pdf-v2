"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  FileText,
  FileUp,
  Hash,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  extractPdfInBrowser,
  ScannedPdfError,
  type ExtractionProgress,
} from "@/lib/pdf/extract";
import type { StoredDocument } from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatNumber } from "@/lib/utils";

interface PdfUploaderProps {
  onDocumentExtracted: (doc: StoredDocument) => Promise<void>;
}

export function PdfUploader({ onDocumentExtracted }: PdfUploaderProps) {
  const { locale, t } = useAppSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [errorState, setErrorState] = useState<{
    isScanned: boolean;
    title: string;
    desc: string;
  } | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<{
    title: string;
    pages: number;
    tokens: number;
    words: number;
  } | null>(null);

  const processPdfBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      setErrorState(null);
      setIsExtracting(true);
      setProgress({ currentPage: 0, totalPages: 1, percent: 4 });

      try {
        const result = await extractPdfInBrowser(buffer, (prog) => {
          setProgress(prog);
        });

        const cleanTitle =
          fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim() ||
          "Dokumen Belajar";

        setRecentMetrics({
          title: cleanTitle,
          pages: result.pageCount,
          tokens: result.estimatedTokens,
          words: result.wordCount,
        });

        const newDoc: StoredDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: cleanTitle,
          fileName,
          pageCount: result.pageCount,
          wordCount: result.wordCount,
          estimatedTokens: result.estimatedTokens,
          pages: result.pages,
          quizHistory: [],
          chatMessages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await onDocumentExtracted(newDoc);
      } catch (err) {
        if (err instanceof ScannedPdfError) {
          setErrorState({
            isScanned: true,
            title: t.upload.scannedErrorTitle,
            desc: t.upload.scannedErrorDesc,
          });
        } else {
          setErrorState({
            isScanned: false,
            title: t.upload.corruptError,
            desc: err instanceof Error ? err.message : "",
          });
        }
      } finally {
        setIsExtracting(false);
      }
    },
    [onDocumentExtracted, t]
  );

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setErrorState({
          isScanned: false,
          title: t.upload.invalidFileError,
          desc: "",
        });
        return;
      }
      const buffer = await file.arrayBuffer();
      await processPdfBuffer(buffer, file.name);
    },
    [processPdfBuffer, t]
  );

  const handleLoadSample = useCallback(async () => {
    setErrorState(null);
    setIsExtracting(true);
    setProgress({ currentPage: 0, totalPages: 12, percent: 5 });
    try {
      const res = await fetch("/samples/biologi-sel-dan-genetika.pdf");
      if (!res.ok) throw new Error("Sample PDF not found.");
      const buffer = await res.arrayBuffer();
      await processPdfBuffer(buffer, "Biologi Sel & Genetika Molekuler.pdf");
    } catch (err) {
      setIsExtracting(false);
      setErrorState({
        isScanned: false,
        title: t.upload.corruptError,
        desc: err instanceof Error ? err.message : "",
      });
    }
  }, [processPdfBuffer, t]);

  return (
    <div className="space-y-5">
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          void handleFile(dropped);
        }}
        className={`transition-all duration-200 ${
          isDragging
            ? "border-primary bg-accent/70 ring-2 ring-primary/30"
            : "border-dashed border-2 border-border hover:border-primary/60"
        }`}
      >
        <CardContent className="p-5 sm:p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            aria-label={t.upload.pickButton}
            className="sr-only"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              void handleFile(selected);
              e.target.value = "";
            }}
          />

          {!isExtracting ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary shadow-2xs ring-1 ring-primary/20"
              >
                <FileUp className="h-8 w-8" />
              </motion.div>

              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  {t.upload.dropTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.upload.dropSubtitle}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2.5 pt-1">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <FileText className="h-5 w-5" />
                  {t.upload.pickButton}
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  onClick={() => void handleLoadSample()}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t.upload.sampleButton}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground max-w-md pt-1 leading-relaxed">
                {t.upload.privacyNote}
              </p>
            </div>
          ) : (
            <div className="py-6 space-y-4 max-w-md mx-auto text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary animate-pulse">
                <FileSearch className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">
                  {t.upload.extracting}
                </p>
                {progress && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {t.upload.pageOf} {progress.currentPage} / {progress.totalPages} (
                    {progress.percent}%)
                  </p>
                )}
              </div>
              <Progress
                value={progress?.percent ?? 10}
                aria-label="PDF Extraction Progress"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Designed Scanned / Corrupt Error Card */}
      {errorState && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-500/20 p-2 text-red-700 dark:text-red-300 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                {errorState.title}
              </h4>
              {errorState.desc && (
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {errorState.desc}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Extraction Telemetry Pill Summary */}
      {recentMetrics && !isExtracting && !errorState && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-accent/80 p-4"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-bold truncate">
              {recentMetrics.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <Layers className="h-3.5 w-3.5" />
              {formatNumber(recentMetrics.pages, locale)} {t.upload.pagesLabel}
            </Badge>
            <Badge variant="secondary">
              <Hash className="h-3.5 w-3.5" />~
              {formatNumber(recentMetrics.tokens, locale)} {t.upload.tokensLabel}
            </Badge>
          </div>
        </motion.div>
      )}
    </div>
  );
}
