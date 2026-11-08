"use client";

import React, { useMemo } from "react";
import {
  BarChart3,
  BookOpen,
  Brain,
  Flame,
  Target,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  calculateDailyStreak,
  type GlobalStudyStats,
  type StoredDocument,
} from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";

interface StatsDashboardProps {
  documents: StoredDocument[];
  globalStats: GlobalStudyStats;
}

export function StatsDashboard({ documents, globalStats }: StatsDashboardProps) {
  const { t } = useAppSettings();

  const streakDays = useMemo(
    () => calculateDailyStreak(globalStats.activeDates),
    [globalStats.activeDates]
  );

  const { totalMasteredCards, totalCards, avgQuizAccuracy, docQuizRows } =
    useMemo(() => {
      const cardTotals = documents.reduce(
        (acc, doc) => {
          const fcList = doc.flashcards ?? [];
          return {
            cards: acc.cards + fcList.length,
            mastered: acc.mastered + fcList.filter((c) => c.mastered).length,
          };
        },
        { cards: 0, mastered: 0 }
      );

      const rows = documents.flatMap((doc) => {
        const history = doc.quizHistory ?? [];
        if (history.length === 0) return [];

        const best = Math.max(...history.map((h) => h.scorePercent));
        const latest = history[0]!.scorePercent;
        const avg = Math.round(
          history.reduce((acc, h) => acc + h.scorePercent, 0) / history.length
        );

        return [
          {
            id: doc.id,
            title: doc.title,
            attempts: history.length,
            best,
            latest,
            avg,
          },
        ];
      });

      const quizAvg =
        rows.length > 0
          ? Math.round(rows.reduce((sum, r) => sum + r.avg, 0) / rows.length)
          : 0;

      return {
        totalMasteredCards: cardTotals.mastered,
        totalCards: cardTotals.cards,
        avgQuizAccuracy: quizAvg,
        docQuizRows: rows,
      };
    }, [documents]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary shrink-0" />
            {t.stats.title}
          </CardTitle>
          <CardDescription>{t.stats.subtitle}</CardDescription>
        </CardHeader>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Flame className="h-5 w-5" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">{streakDays}</div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t.stats.streakUnit}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">
              {docQuizRows.length > 0 ? `${avgQuizAccuracy}%` : "—"}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t.stats.avgAccuracy}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">
              {totalMasteredCards}
              <span className="text-sm font-semibold text-muted-foreground">
                /{totalCards}
              </span>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t.stats.cardsMastered}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="text-2xl sm:text-3xl font-black">
              {documents.length}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t.stats.docsStudied}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Document Quiz Accuracy Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">
            {t.stats.perDocAccuracyTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docQuizRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t.stats.noQuizYet}
            </p>
          ) : (
            <div className="space-y-4">
              {docQuizRows.map((row) => (
                <div key={row.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold truncate max-w-[240px] sm:max-w-md">
                      {row.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {row.attempts} {t.stats.attempts}
                      </Badge>
                      <Badge variant={row.best >= 80 ? "success" : "secondary"}>
                        {t.stats.bestScore}: {row.best}%
                      </Badge>
                    </div>
                  </div>
                  <Progress
                    value={row.avg}
                    aria-label={`${row.title} average accuracy ${row.avg}%`}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
