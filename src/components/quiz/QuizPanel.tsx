"use client";

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AiErrorBanner } from "@/components/ui/ai-error-banner";
import { ExportMenu } from "@/components/export/ExportMenu";
import type {
  QuizDifficulty,
  QuizOptionKey,
  QuizQuestion,
} from "@/lib/ai/schemas";
import type { StoredDocument } from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useAiClient, type FriendlyAiError } from "@/hooks/use-ai-client";

interface QuizPanelProps {
  doc: StoredDocument;
  onUpdateDocument: (updated: StoredDocument) => Promise<void>;
}

const OPTION_KEYS: QuizOptionKey[] = ["A", "B", "C", "D", "E"];
const QUESTION_COUNTS = [5, 8, 10, 15];

export function QuizPanel({ doc, onUpdateDocument }: QuizPanelProps) {
  const { locale, t } = useAppSettings();
  const { postJson } = useAiClient();

  const [difficulty, setDifficulty] = useState<QuizDifficulty>(
    doc.quiz?.difficulty ?? "medium"
  );
  const [questionCount, setQuestionCount] = useState<number>(
    doc.quiz?.questions.length ?? 5
  );
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>(
    doc.quiz?.questions ?? []
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, QuizOptionKey>>({});
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [isRetryWrongMode, setIsRetryWrongMode] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(!doc.quiz?.questions.length);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<FriendlyAiError | null>(null);

  const generateQuiz = useCallback(
    async (forceDemo = false) => {
      setError(null);
      setIsGenerating(true);

      try {
        const res = await postJson<{ questions: QuizQuestion[] }>(
          "/api/ai/quiz",
          {
            documentTitle: doc.title,
            pages: doc.pages,
            difficulty,
            questionCount,
            locale,
          },
          { forceDemo }
        );

        setActiveQuestions(res.questions);
        setCurrentIndex(0);
        setAnswers({});
        setQuizCompleted(false);
        setIsRetryWrongMode(false);
        setShowConfig(false);

        await onUpdateDocument({
          ...doc,
          quiz: {
            difficulty,
            questions: res.questions,
            generatedAt: Date.now(),
          },
        });
      } catch (err) {
        setError(err as FriendlyAiError);
      } finally {
        setIsGenerating(false);
      }
    },
    [difficulty, doc, locale, onUpdateDocument, postJson, questionCount]
  );

  const currentQuestion = activeQuestions[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleSelectOption = (opt: QuizOptionKey) => {
    if (!currentQuestion || selectedAnswer) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: opt,
    }));
  };

  const finishAndRecordScore = async () => {
    const correctCount = activeQuestions.filter(
      (q) => answers[q.id] === q.correctOption
    ).length;
    const totalCount = activeQuestions.length;
    const scorePercent =
      totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    setQuizCompleted(true);

    const attempt = {
      id: `att-${Date.now()}`,
      scorePercent,
      correctCount,
      totalCount,
      difficulty,
      completedAt: Date.now(),
    };

    await onUpdateDocument({
      ...doc,
      quizHistory: [attempt, ...(doc.quizHistory ?? [])].slice(0, 25),
    });
  };

  const handleRetryWrongOnly = () => {
    const wrong = activeQuestions.filter(
      (q) => answers[q.id] !== q.correctOption
    );
    if (wrong.length === 0) return;
    setActiveQuestions(wrong);
    setAnswers({});
    setCurrentIndex(0);
    setQuizCompleted(false);
    setIsRetryWrongMode(true);
  };

  const handleRetryAll = () => {
    const fullQuestions = doc.quiz?.questions ?? activeQuestions;
    setActiveQuestions(fullQuestions);
    setAnswers({});
    setCurrentIndex(0);
    setQuizCompleted(false);
    setIsRetryWrongMode(false);
  };

  const correctTotal = activeQuestions.filter(
    (q) => answers[q.id] === q.correctOption
  ).length;
  const wrongQuestions = activeQuestions.filter(
    (q) => answers[q.id] !== q.correctOption
  );
  const finalScore =
    activeQuestions.length > 0
      ? Math.round((correctTotal / activeQuestions.length) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Header & Configuration Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
                {t.quiz.title}
              </CardTitle>
              <CardDescription className="mt-1">{t.quiz.subtitle}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {activeQuestions.length > 0 && !showConfig && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfig((s) => !s)}
                >
                  {t.quiz.newQuizBtn}
                </Button>
              )}
              <ExportMenu doc={doc} />
            </div>
          </div>
        </CardHeader>

        {showConfig && (
          <CardContent className="space-y-4">
            {/* Difficulty Selector */}
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.quiz.difficultyLabel}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as QuizDifficulty[]).map((lvl) => {
                  const active = difficulty === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDifficulty(lvl)}
                      className={`min-h-11 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary/30"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {t.quiz.difficulties[lvl]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question Count Selector */}
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.quiz.countLabel}: <strong className="text-foreground">{questionCount}</strong>
              </span>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((cnt) => (
                  <Button
                    key={cnt}
                    type="button"
                    size="sm"
                    variant={questionCount === cnt ? "default" : "outline"}
                    onClick={() => setQuestionCount(cnt)}
                  >
                    {cnt} {t.quiz.questionProgress}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              disabled={isGenerating}
              onClick={() => void generateQuiz(false)}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.quiz.generating}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {t.quiz.generateBtn}
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>

      <AiErrorBanner error={error} onRetryWithDemo={() => void generateQuiz(true)} />

      {/* Skeleton while generating */}
      {isGenerating && (
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Active Quiz Interactive Card */}
      {!isGenerating && activeQuestions.length > 0 && !quizCompleted && currentQuestion && (
        <div className="space-y-4">
          {isRetryWrongMode && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t.quiz.retryModeBanner} ({activeQuestions.length})
            </div>
          )}

          <Card>
            <CardContent className="p-4 sm:p-6 space-y-5">
              {/* Top Progress Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t.quiz.questionProgress} {currentIndex + 1} / {activeQuestions.length}
                  </span>
                  {currentQuestion.pageReference && (
                    <Badge variant="secondary">
                      {t.quiz.pageRef} {currentQuestion.pageReference}
                    </Badge>
                  )}
                </div>
                <Progress
                  value={Math.round(((currentIndex + 1) / activeQuestions.length) * 100)}
                  aria-label="Quiz Question Progress"
                />
              </div>

              {/* Question Stem */}
              <h3 className="text-base sm:text-lg font-bold leading-relaxed text-foreground">
                {currentQuestion.question}
              </h3>

              {/* Options A-E */}
              <div
                data-testid="quiz-options"
                className="space-y-2.5"
                role="radiogroup"
                aria-label={currentQuestion.question}
              >
                {OPTION_KEYS.map((letter) => {
                  const optionText = currentQuestion.options[letter];
                  const isSelected = selectedAnswer === letter;
                  const isCorrect = currentQuestion.correctOption === letter;
                  const showFeedback = Boolean(selectedAnswer);

                  let styleClass =
                    "border-border bg-background/70 hover:bg-muted text-foreground";
                  if (showFeedback) {
                    if (isCorrect) {
                      styleClass =
                        "border-emerald-500 bg-emerald-500/15 text-foreground ring-1 ring-emerald-500/40";
                    } else if (isSelected && !isCorrect) {
                      styleClass =
                        "border-red-500 bg-red-500/12 text-foreground ring-1 ring-red-500/40";
                    } else {
                      styleClass = "border-border/60 bg-background/40 opacity-65";
                    }
                  }

                  return (
                    <motion.button
                      key={letter}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={showFeedback}
                      onClick={() => handleSelectOption(letter)}
                      whileTap={!showFeedback ? { scale: 0.99 } : undefined}
                      animate={
                        showFeedback && isSelected && !isCorrect
                          ? { x: [0, -5, 5, -3, 3, 0] }
                          : undefined
                      }
                      transition={{ duration: 0.3 }}
                      className={`flex w-full min-h-12 items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${styleClass}`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                          showFeedback && isCorrect
                            ? "bg-emerald-600 text-white"
                            : showFeedback && isSelected && !isCorrect
                              ? "bg-red-600 text-white"
                              : "bg-muted text-foreground"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 pt-0.5 leading-relaxed font-medium">
                        {optionText}
                      </span>
                      {showFeedback && isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      {showFeedback && isSelected && !isCorrect && (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Instant Explanation after Answering */}
              <AnimatePresence>
                {selectedAnswer && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl border border-primary/25 bg-accent/80 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-accent-foreground">
                        <BookOpenCheck className="h-4 w-4" />
                        {selectedAnswer === currentQuestion.correctOption
                          ? t.quiz.correctBadge
                          : `${t.quiz.wrongBadge} • Kunci: ${currentQuestion.correctOption}`}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {currentQuestion.explanation}
                    </p>

                    <div className="pt-2 flex justify-end">
                      {currentIndex < activeQuestions.length - 1 ? (
                        <Button
                          type="button"
                          onClick={() => setCurrentIndex((idx) => idx + 1)}
                        >
                          {t.quiz.nextQuestion}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => void finishAndRecordScore()}
                        >
                          <Award className="h-4 w-4" />
                          {t.quiz.finishQuiz}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Final Quiz Evaluation & Retry Wrong Questions */}
      {!isGenerating && quizCompleted && (
        <Card>
          <CardContent className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary ring-1 ring-primary/25">
                <Award className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-extrabold">{t.quiz.scoreTitle}</h3>
              <div className="text-4xl sm:text-5xl font-black text-primary">
                {finalScore}%
              </div>
              <Badge variant={finalScore >= 80 ? "success" : "warning"}>
                {correctTotal} / {activeQuestions.length} Benar
              </Badge>
              <p className="text-sm text-muted-foreground max-w-md">
                {finalScore >= 85
                  ? t.quiz.scorePerfect
                  : finalScore >= 65
                    ? t.quiz.scoreGood
                    : t.quiz.scoreNeedsWork}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-2.5">
              {wrongQuestions.length > 0 && (
                <Button
                  type="button"
                  size="lg"
                  onClick={handleRetryWrongOnly}
                  className="w-full sm:w-auto"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t.quiz.retryWrongBtn} ({wrongQuestions.length})
                </Button>
              )}

              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={handleRetryAll}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                {t.quiz.retryAllBtn}
              </Button>

              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => setShowConfig(true)}
                className="w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                {t.quiz.newQuizBtn}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Designed Empty State */}
      {!isGenerating && activeQuestions.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-10 px-5 text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold">{t.quiz.emptyTitle}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t.quiz.emptyDesc}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
