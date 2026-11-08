"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import {
  Brain,
  Check,
  Gamepad2,
  Lightbulb,
  Loader2,
  RotateCw,
  Shuffle,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AiErrorBanner } from "@/components/ui/ai-error-banner";
import { ExportMenu } from "@/components/export/ExportMenu";
import type { FlashcardItem } from "@/lib/ai/schemas";
import type { StoredDocument, StoredFlashcard } from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useAiClient, type FriendlyAiError } from "@/hooks/use-ai-client";

interface FlashcardPanelProps {
  doc: StoredDocument;
  onUpdateDocument: (updated: StoredDocument) => Promise<void>;
}

type Stage = "setup" | "study" | "match";

const CARD_COUNTS = [6, 10, 15, 20];

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function FlashcardPanel({ doc, onUpdateDocument }: FlashcardPanelProps) {
  const { locale, t } = useAppSettings();
  const { postJson } = useAiClient();

  const [stage, setStage] = useState<Stage>(
    doc.flashcards && doc.flashcards.length > 0 ? "study" : "setup"
  );
  const [cardCount, setCardCount] = useState<number>(8);
  const [focusTopic, setFocusTopic] = useState<string>("");

  const [deck, setDeck] = useState<StoredFlashcard[]>(doc.flashcards ?? []);
  // Weighted study queue storing card IDs for spaced repetition
  const [studyQueue, setStudyQueue] = useState<string[]>(() =>
    (doc.flashcards ?? [])
      .slice()
      .sort((a, b) => a.box - b.box)
      .map((c) => c.id)
  );
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Matching game state
  const [matchPairs, setMatchPairs] = useState<StoredFlashcard[]>([]);
  const [shuffledDefs, setShuffledDefs] = useState<StoredFlashcard[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [mismatchFlash, setMismatchFlash] = useState<boolean>(false);
  const [matchAttempts, setMatchAttempts] = useState<number>(0);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<FriendlyAiError | null>(null);

  // Motion swipe values
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-160, 0, 160], [-9, 0, 9]);
  const rightBadgeOpacity = useTransform(dragX, [25, 110], [0, 1]);
  const leftBadgeOpacity = useTransform(dragX, [-110, -25], [1, 0]);

  const initMatchingRound = useCallback((sourceCards: StoredFlashcard[]) => {
    const subset = shuffleArray(sourceCards).slice(0, Math.min(6, sourceCards.length));
    setMatchPairs(subset);
    setShuffledDefs(shuffleArray(subset));
    setSelectedTermId(null);
    setSelectedDefId(null);
    setMatchedIds(new Set());
    setMatchAttempts(0);
    setMismatchFlash(false);
  }, []);

  const generateCards = useCallback(
    async (forceDemo = false) => {
      setError(null);
      setIsGenerating(true);

      try {
        const res = await postJson<{ cards: FlashcardItem[] }>(
          "/api/ai/flashcards",
          {
            documentTitle: doc.title,
            pages: doc.pages,
            cardCount,
            focusTopic,
            locale,
          },
          { forceDemo }
        );

        const enriched: StoredFlashcard[] = res.cards.map((c) => ({
          ...c,
          box: 1,
          mastered: false,
          reviewCount: 0,
        }));

        setDeck(enriched);
        setStudyQueue(enriched.map((c) => c.id));
        setIsFlipped(false);
        setStage("study");

        await onUpdateDocument({
          ...doc,
          flashcards: enriched,
        });
      } catch (err) {
        setError(err as FriendlyAiError);
      } finally {
        setIsGenerating(false);
      }
    },
    [cardCount, doc, focusTopic, locale, onUpdateDocument, postJson]
  );

  const activeCardId = studyQueue[0];
  const activeCard = useMemo(
    () => deck.find((c) => c.id === activeCardId) ?? deck[0],
    [activeCardId, deck]
  );

  const masteredCount = useMemo(
    () => deck.filter((c) => c.mastered).length,
    [deck]
  );

  const handleRateCard = useCallback(
    async (gotIt: boolean) => {
      if (!activeCard) return;

      const updatedDeck: StoredFlashcard[] = deck.map((card) => {
        if (card.id !== activeCard.id) return card;
        const nextBox: 1 | 2 | 3 = gotIt
          ? (Math.min(3, card.box + 1) as 1 | 2 | 3)
          : 1;
        return {
          ...card,
          box: nextBox,
          mastered: gotIt && nextBox >= 2,
          reviewCount: card.reviewCount + 1,
          lastReviewedAt: Date.now(),
        };
      });

      setDeck(updatedDeck);
      setIsFlipped(false);
      dragX.set(0);

      // Spaced repetition queue scheduling:
      // "Not yet" re-enters 2 positions ahead so user practices it much sooner!
      // "Got it" cycles to the back of the queue.
      setStudyQueue((prev) => {
        const rest = prev.slice(1);
        if (rest.length === 0) return [activeCard.id];
        if (!gotIt) {
          const insertIdx = Math.min(2, rest.length);
          return [
            ...rest.slice(0, insertIdx),
            activeCard.id,
            ...rest.slice(insertIdx),
          ];
        }
        return [...rest, activeCard.id];
      });

      await onUpdateDocument({
        ...doc,
        flashcards: updatedDeck,
      });
    },
    [activeCard, deck, doc, dragX, onUpdateDocument]
  );

  // Keyboard shortcuts in Study mode
  useEffect(() => {
    if (stage !== "study" || !activeCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        void handleRateCard(true);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        void handleRateCard(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeCard, handleRateCard, stage]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 85) {
      void handleRateCard(true);
    } else if (info.offset.x < -85) {
      void handleRateCard(false);
    }
  };

  // Matching Game Pair Check
  const evaluateMatchPick = (termId: string | null, defId: string | null) => {
    if (!termId || !defId) return;
    setMatchAttempts((a) => a + 1);
    if (termId === defId) {
      setMatchedIds((prev) => new Set(prev).add(termId));
      setSelectedTermId(null);
      setSelectedDefId(null);
    } else {
      setMismatchFlash(true);
      setTimeout(() => {
        setSelectedTermId(null);
        setSelectedDefId(null);
        setMismatchFlash(false);
      }, 480);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & 3-Stage Stepper */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary shrink-0" />
                {t.flashcards.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {t.flashcards.subtitle}
              </CardDescription>
            </div>
            <ExportMenu doc={doc} />
          </div>

          {/* 3-Stage Segmented Tabs */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1 mt-3">
            {(["setup", "study", "match"] as Stage[]).map((s) => {
              const disabled = s !== "setup" && deck.length === 0;
              const active = stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (s === "match") initMatchingRound(deck);
                    setStage(s);
                  }}
                  className={`min-h-11 rounded-lg px-2 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    active
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.flashcards.stages[s]}
                </button>
              );
            })}
          </div>
        </CardHeader>

        {/* STAGE 1: SETUP */}
        {stage === "setup" && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.flashcards.countLabel}:{" "}
                <strong className="text-foreground">{cardCount}</strong>
              </span>
              <div className="flex flex-wrap gap-2">
                {CARD_COUNTS.map((cnt) => (
                  <Button
                    key={cnt}
                    type="button"
                    size="sm"
                    variant={cardCount === cnt ? "default" : "outline"}
                    onClick={() => setCardCount(cnt)}
                  >
                    {cnt} Kartu
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="fc-focus-input"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {t.flashcards.focusLabel}
              </label>
              <input
                id="fc-focus-input"
                type="text"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                placeholder={t.flashcards.focusPlaceholder}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button
              type="button"
              size="lg"
              disabled={isGenerating}
              onClick={() => void generateCards(false)}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.flashcards.generating}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {t.flashcards.generateBtn}
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>

      <AiErrorBanner error={error} onRetryWithDemo={() => void generateCards(true)} />

      {isGenerating && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STAGE 2: STUDY (3D Flip + Mobile Swipe + Spaced Repetition) */}
      {!isGenerating && stage === "study" && activeCard && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Badge variant="success">
                {t.flashcards.masteredCount}: {masteredCount} / {deck.length}
              </Badge>
              <Badge variant="outline">Leitner Box {activeCard.box}/3</Badge>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                initMatchingRound(deck);
                setStage("match");
              }}
            >
              <Gamepad2 className="h-4 w-4 text-primary" />
              {t.flashcards.startMatchingBtn}
            </Button>
          </div>

          {/* Draggable + 3D Flippable Card */}
          <div className="perspective-1000 relative mx-auto max-w-xl py-1">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.65}
              style={{ x: dragX, rotate: cardRotate }}
              onDragEnd={handleDragEnd}
              className="relative touch-pan-y select-none cursor-grab active:cursor-grabbing"
            >
              {/* Swipe Feedback Overlays */}
              <motion.div
                style={{ opacity: rightBadgeOpacity }}
                className="pointer-events-none absolute right-4 top-4 z-20 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-md"
              >
                ✓ {t.flashcards.gotItBtn}
              </motion.div>
              <motion.div
                style={{ opacity: leftBadgeOpacity }}
                className="pointer-events-none absolute left-4 top-4 z-20 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-md"
              >
                ↺ {t.flashcards.notYetBtn}
              </motion.div>

              <button
                type="button"
                onClick={() => setIsFlipped((f) => !f)}
                aria-label={`${activeCard.term} - ${t.flashcards.tapToFlip}`}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl cursor-pointer"
              >
                <div
                  className={`preserve-3d relative min-h-[260px] sm:min-h-[290px] w-full transition-transform duration-500 ${
                    isFlipped ? "rotate-y-180" : ""
                  }`}
                >
                  {/* FRONT: TERM */}
                  <div className="backface-hidden absolute inset-0 flex flex-col justify-between rounded-2xl border-2 border-primary/25 bg-card p-6 sm:p-8 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                        {t.flashcards.termSide}
                      </span>
                      {activeCard.pageReference && (
                        <Badge variant="secondary">
                          Hal. {activeCard.pageReference}
                        </Badge>
                      )}
                    </div>

                    <div className="my-auto py-4 text-center">
                      <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-snug">
                        {activeCard.term}
                      </h3>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <RotateCw className="h-3.5 w-3.5" />
                      {t.flashcards.tapToFlip}
                    </div>
                  </div>

                  {/* BACK: DEFINITION & HINT */}
                  <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-2xl border-2 border-emerald-500/40 bg-accent/95 p-6 sm:p-8 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-accent-foreground">
                        {t.flashcards.defSide}
                      </span>
                      {activeCard.pageReference && (
                        <Badge variant="success">
                          Hal. {activeCard.pageReference}
                        </Badge>
                      )}
                    </div>

                    <div className="my-auto py-3 space-y-3">
                      <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                        {activeCard.definition}
                      </p>
                      {activeCard.hint && (
                        <div className="flex items-start gap-2 rounded-xl bg-card/80 p-2.5 text-xs text-muted-foreground">
                          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>
                            <strong>{t.flashcards.hintLabel}:</strong> {activeCard.hint}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-center text-xs text-muted-foreground">
                      {t.flashcards.swipeHint}
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          </div>

          {/* Accessible Action Buttons */}
          <div className="mx-auto max-w-xl space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => void handleRateCard(false)}
                className="border-amber-500/40 hover:bg-amber-500/10"
              >
                <X className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                {t.flashcards.notYetBtn}
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={() => void handleRateCard(true)}
              >
                <Check className="h-5 w-5" />
                {t.flashcards.gotItBtn}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t.flashcards.spacedRepNote}
            </p>
          </div>
        </div>
      )}

      {/* STAGE 3: MATCHING GAME EVALUATION */}
      {!isGenerating && stage === "match" && matchPairs.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-bold">
                  {t.flashcards.matchTitle}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t.flashcards.matchInstruction}
                </p>
              </div>
              <Badge variant="secondary">
                {matchedIds.size} / {matchPairs.length} • {t.flashcards.attemptsLabel}:{" "}
                {matchAttempts}
              </Badge>
            </div>

            {matchedIds.size === matchPairs.length ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-8 text-center space-y-4"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary">
                  <Trophy className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-extrabold">
                  {t.flashcards.matchCompleteTitle}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t.flashcards.accuracyLabel}:{" "}
                  <strong className="text-foreground">
                    {Math.round(
                      (matchPairs.length / Math.max(1, matchAttempts)) * 100
                    )}
                    %
                  </strong>{" "}
                  ({matchAttempts} {t.flashcards.attemptsLabel})
                </p>
                <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    onClick={() => initMatchingRound(deck)}
                  >
                    <Shuffle className="h-4 w-4" />
                    {t.flashcards.playAgainBtn}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStage("study")}
                  >
                    {t.flashcards.backToStudyBtn}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Terms Column */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t.flashcards.termsCol}
                  </span>
                  {matchPairs.map((item) => {
                    const isMatched = matchedIds.has(item.id);
                    const isSelected = selectedTermId === item.id;
                    return (
                      <button
                        key={`term-${item.id}`}
                        type="button"
                        disabled={isMatched}
                        onClick={() => {
                          setSelectedTermId(item.id);
                          evaluateMatchPick(item.id, selectedDefId);
                        }}
                        className={`w-full min-h-12 rounded-xl border p-3 text-left text-sm font-bold transition-all cursor-pointer disabled:cursor-default ${
                          isMatched
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 opacity-65"
                            : isSelected && mismatchFlash
                              ? "border-red-500 bg-red-500/15"
                              : isSelected
                                ? "border-primary bg-accent ring-2 ring-primary/35"
                                : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {isMatched ? `✓ ${item.term}` : item.term}
                      </button>
                    );
                  })}
                </div>

                {/* Definitions Column */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t.flashcards.defsCol}
                  </span>
                  {shuffledDefs.map((item) => {
                    const isMatched = matchedIds.has(item.id);
                    const isSelected = selectedDefId === item.id;
                    return (
                      <button
                        key={`def-${item.id}`}
                        type="button"
                        disabled={isMatched}
                        onClick={() => {
                          setSelectedDefId(item.id);
                          evaluateMatchPick(selectedTermId, item.id);
                        }}
                        className={`w-full min-h-12 rounded-xl border p-3 text-left text-xs sm:text-sm leading-relaxed transition-all cursor-pointer disabled:cursor-default ${
                          isMatched
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 opacity-65"
                            : isSelected && mismatchFlash
                              ? "border-red-500 bg-red-500/15"
                              : isSelected
                                ? "border-primary bg-accent ring-2 ring-primary/35"
                                : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {item.definition}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
