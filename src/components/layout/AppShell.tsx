"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useTheme } from "next-themes";
import {
  BarChart3,
  BookMarked,
  Brain,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Flame,
  Globe,
  KeyRound,
  MessageSquareText,
  Moon,
  Sparkles,
  Stethoscope,
  Sun,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SettingsModal } from "@/components/layout/SettingsModal";
import { PdfUploader } from "@/components/pdf/PdfUploader";
import { SummaryPanel } from "@/components/summary/SummaryPanel";
import { QuizPanel } from "@/components/quiz/QuizPanel";
import { FlashcardPanel } from "@/components/flashcards/FlashcardPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { LibraryPanel } from "@/components/library/LibraryPanel";
import { StatsDashboard } from "@/components/library/StatsDashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  calculateDailyStreak,
  deleteDocument,
  getGlobalStats,
  listDocuments,
  renameDocument,
  saveDocument,
  type GlobalStudyStats,
  type StoredDocument,
} from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatNumber } from "@/lib/utils";

export type WorkspaceTab =
  | "upload"
  | "summary"
  | "quiz"
  | "flashcards"
  | "chat"
  | "library"
  | "stats";

const emptySubscribe = () => () => {};

export function AppShell() {
  const {
    locale,
    setLocale,
    t,
    customApiKey,
    demoMode,
    setSettingsOpen,
  } = useAppSettings();
  const { resolvedTheme, setTheme } = useTheme();

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("upload");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStudyStats>({
    id: "global",
    activeDates: [],
    totalStudyEvents: 0,
  });

  const refreshFromDb = useCallback(async () => {
    try {
      const [docs, stats] = await Promise.all([
        listDocuments(),
        getGlobalStats(),
      ]);
      setDocuments(docs);
      setGlobalStats(stats);
      return docs;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDocuments(), getGlobalStats()])
      .then(([docs, stats]) => {
        if (cancelled) return;
        setDocuments(docs);
        setGlobalStats(stats);
        if (docs.length > 0 && docs[0]) {
          setActiveDocId(docs[0].id);
          setActiveTab("summary");
        }
      })
      .catch(() => {
        // Ignore initial IndexedDB load error
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? null,
    [activeDocId, documents]
  );

  const streakDays = useMemo(
    () => calculateDailyStreak(globalStats.activeDates),
    [globalStats.activeDates]
  );

  const handleDocumentExtracted = useCallback(
    async (newDoc: StoredDocument) => {
      const saved = await saveDocument(newDoc);
      await refreshFromDb();
      setActiveDocId(saved.id);
      setActiveTab("summary");
    },
    [refreshFromDb]
  );

  const handleUpdateDocument = useCallback(
    async (updated: StoredDocument) => {
      await saveDocument(updated);
      await refreshFromDb();
    },
    [refreshFromDb]
  );

  const handleRenameDocument = useCallback(
    async (id: string, newTitle: string) => {
      await renameDocument(id, newTitle);
      await refreshFromDb();
    },
    [refreshFromDb]
  );

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id);
      const remaining = await refreshFromDb();
      if (activeDocId === id) {
        if (remaining.length > 0 && remaining[0]) {
          setActiveDocId(remaining[0].id);
        } else {
          setActiveDocId(null);
          setActiveTab("upload");
        }
      }
    },
    [activeDocId, refreshFromDb]
  );

  const sidebarItems: Array<{
    key: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresDoc?: boolean;
  }> = [
    { key: "upload", label: t.nav.upload, icon: FilePlus2 },
    { key: "summary", label: t.nav.summary, icon: Stethoscope, requiresDoc: true },
    { key: "quiz", label: t.nav.quiz, icon: ClipboardCheck, requiresDoc: true },
    { key: "flashcards", label: t.nav.flashcards, icon: Brain, requiresDoc: true },
    { key: "chat", label: t.nav.chat, icon: MessageSquareText, requiresDoc: true },
    { key: "library", label: t.nav.library, icon: BookMarked },
    { key: "stats", label: t.nav.stats, icon: BarChart3 },
  ];

  const mobileNavItems: Array<{
    key: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    activeDoc
      ? { key: "summary", label: t.nav.summary, icon: Stethoscope }
      : { key: "upload", label: t.nav.upload, icon: FilePlus2 },
    { key: "quiz", label: t.nav.quiz, icon: ClipboardCheck },
    { key: "flashcards", label: t.nav.flashcards, icon: Brain },
    { key: "chat", label: t.nav.chat, icon: MessageSquareText },
    { key: "library", label: t.nav.library, icon: BookMarked },
  ];

  const needsDocButMissing =
    !activeDoc &&
    (activeTab === "summary" ||
      activeTab === "quiz" ||
      activeTab === "flashcards" ||
      activeTab === "chat");

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row drpdf-ambient-bg">
      {/* DESKTOP SIDEBAR (>= 1024px) */}
      <aside
        aria-label="Sidebar Navigation"
        className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:justify-between border-r border-border bg-card/85 backdrop-blur-md p-5 sticky top-0 h-dvh overflow-y-auto"
      >
        <div className="space-y-6">
          <BrandLogo showTagline tagline={t.brandTagline} />

          {/* Active Document Mini Card */}
          {activeDoc && (
            <div className="rounded-2xl border border-primary/25 bg-accent/75 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent-foreground">
                  {t.upload.activeDoc}
                </span>
                <Badge variant="success">{activeDoc.pageCount} hal</Badge>
              </div>
              <p className="text-xs font-bold text-foreground truncate">
                {activeDoc.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                ~{formatNumber(activeDoc.estimatedTokens, locale)} token
              </p>
            </div>
          )}

          {/* Primary Nav Links */}
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  aria-current={isSelected ? "page" : undefined}
                  className={`flex w-full min-h-11 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-foreground/85 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.key === "library" && documents.length > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {documents.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Sidebar Footer Controls */}
        <div className="space-y-3 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className="flex w-full min-h-11 items-center justify-between rounded-xl border border-border bg-background/70 px-3.5 py-2 text-xs font-bold hover:bg-muted cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              {t.stats.streakTitle}
            </span>
            <span className="text-primary">{streakDays}d</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocale(locale === "id" ? "en" : "id")}
              aria-label="Toggle UI Language"
              className="flex-1"
            >
              <Globe className="h-4 w-4 text-primary" />
              <span>{locale === "id" ? "Indonesia" : "English"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Toggle color theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t.nav.settings}
              onClick={() => setSettingsOpen(true)}
              className="relative"
            >
              <KeyRound className="h-4 w-4" />
              {(customApiKey || demoMode) && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* MOBILE / TABLET TOP HEADER (< 1024px) */}
        <header className="lg:hidden sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur-md">
          <div className="flex h-15 items-center justify-between gap-2 px-3.5">
            <button
              type="button"
              onClick={() => setActiveTab(activeDoc ? "summary" : "upload")}
              className="text-left focus-visible:outline-none cursor-pointer"
            >
              <BrandLogo />
            </button>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={activeTab === "stats" ? "default" : "ghost"}
                size="sm"
                aria-label={t.nav.stats}
                onClick={() => setActiveTab("stats")}
                className="px-2.5"
              >
                <Flame className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-extrabold">{streakDays}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Switch Language"
                onClick={() => setLocale(locale === "id" ? "en" : "id")}
                className="px-2.5 font-bold text-xs"
              >
                {locale.toUpperCase()}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Toggle color theme"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {mounted && resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.nav.settings}
                onClick={() => setSettingsOpen(true)}
                className="relative"
              >
                <KeyRound className="h-4 w-4" />
                {(customApiKey || demoMode) && (
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </Button>
            </div>
          </div>

          {/* Compact Active Document Strip on Mobile */}
          {activeDoc && (
            <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-accent/55 px-3.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold truncate">
                  {activeDoc.title}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  ({activeDoc.pageCount}p)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-card px-2.5 py-1 text-xs font-bold text-primary border border-border shrink-0 cursor-pointer"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                <span>PDF Baru</span>
              </button>
            </div>
          )}
        </header>

        {/* WORKSPACE MAIN CONTENT */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-5 pb-28 lg:py-8">
          {/* Active Mode Pill Notice if Demo Mode is ON */}
          {demoMode && (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-accent/80 px-3.5 py-2 text-xs font-semibold text-accent-foreground">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {t.settings.demoModeLabel}
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="underline font-bold cursor-pointer py-1 px-1"
              >
                {t.nav.settings}
              </button>
            </div>
          )}

          {/* UPLOAD / HERO VIEW */}
          {(activeTab === "upload" || needsDocButMissing) && (
            <div className="space-y-6">
              <section className="space-y-2.5 text-center sm:text-left">
                <Badge variant="default" className="py-1 px-3">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.heroBadge}
                </Badge>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  {t.heroTitle}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                  {t.heroSubtitle}
                </p>
              </section>

              <PdfUploader onDocumentExtracted={handleDocumentExtracted} />
            </div>
          )}

          {/* SUMMARY VIEW */}
          {activeTab === "summary" && activeDoc && (
            <SummaryPanel
              key={activeDoc.id}
              doc={activeDoc}
              onUpdateDocument={handleUpdateDocument}
            />
          )}

          {/* QUIZ VIEW */}
          {activeTab === "quiz" && activeDoc && (
            <QuizPanel
              key={activeDoc.id}
              doc={activeDoc}
              onUpdateDocument={handleUpdateDocument}
            />
          )}

          {/* FLASHCARDS VIEW */}
          {activeTab === "flashcards" && activeDoc && (
            <FlashcardPanel
              key={activeDoc.id}
              doc={activeDoc}
              onUpdateDocument={handleUpdateDocument}
            />
          )}

          {/* CHAT WITH PDF VIEW */}
          {activeTab === "chat" && activeDoc && (
            <ChatPanel
              key={activeDoc.id}
              doc={activeDoc}
              onUpdateDocument={handleUpdateDocument}
            />
          )}

          {/* LOCAL LIBRARY VIEW */}
          {activeTab === "library" && (
            <LibraryPanel
              documents={documents}
              activeDocId={activeDocId}
              onOpenDocument={(doc) => {
                setActiveDocId(doc.id);
                setActiveTab("summary");
              }}
              onRenameDocument={handleRenameDocument}
              onDeleteDocument={handleDeleteDocument}
              onGoUpload={() => setActiveTab("upload")}
            />
          )}

          {/* STUDY STATS VIEW */}
          {activeTab === "stats" && (
            <StatsDashboard
              documents={documents}
              globalStats={globalStats}
            />
          )}
        </main>

        {/* MOBILE BOTTOM NAVIGATION (< 1024px) */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 px-1 py-1">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const isSelected =
                activeTab === item.key ||
                (item.key === "summary" && activeTab === "upload" && Boolean(activeDoc));
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  aria-current={isSelected ? "page" : undefined}
                  className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "text-primary bg-accent/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate max-w-full leading-snug pb-0.5">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <SettingsModal />
    </div>
  );
}
