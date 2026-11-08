import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  FlashcardItem,
  PageChunk,
  QuizDifficulty,
  QuizQuestion,
  SummaryMode,
} from "@/lib/ai/schemas";
import { todayKey } from "@/lib/utils";

export interface StoredFlashcard extends FlashcardItem {
  box: 1 | 2 | 3; // Leitner spaced-repetition box (1 = repeat often, 3 = mastered)
  mastered: boolean;
  reviewCount: number;
  lastReviewedAt?: number;
}

export interface StoredSummary {
  mode: SummaryMode;
  extraInstructions: string;
  markdown: string;
  generatedAt: number;
}

export interface StoredQuiz {
  difficulty: QuizDifficulty;
  questions: QuizQuestion[];
  generatedAt: number;
}

export interface QuizAttemptRecord {
  id: string;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  difficulty: QuizDifficulty;
  completedAt: number;
}

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface StoredDocument {
  id: string;
  title: string;
  fileName: string;
  pageCount: number;
  wordCount: number;
  estimatedTokens: number;
  pages: PageChunk[];
  summary?: StoredSummary;
  quiz?: StoredQuiz;
  quizHistory: QuizAttemptRecord[];
  flashcards?: StoredFlashcard[];
  chatMessages: StoredChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface GlobalStudyStats {
  id: "global";
  activeDates: string[]; // YYYY-MM-DD strings sorted ascending
  totalStudyEvents: number;
}

interface DrPdfDbSchema extends DBSchema {
  documents: {
    key: string;
    value: StoredDocument;
    indexes: { "by-updated": number };
  };
  stats: {
    key: string;
    value: GlobalStudyStats;
  };
}

const DB_NAME = "drpdf-v2-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DrPdfDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DrPdfDbSchema>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in the browser."));
  }
  if (!dbPromise) {
    dbPromise = openDB<DrPdfDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          const store = db.createObjectStore("documents", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
        }
        if (!db.objectStoreNames.contains("stats")) {
          db.createObjectStore("stats", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("documents", "by-updated");
  return all.reverse(); // Most recently updated first
}

export async function getDocumentById(id: string): Promise<StoredDocument | undefined> {
  const db = await getDb();
  return db.get("documents", id);
}

export async function saveDocument(doc: StoredDocument): Promise<StoredDocument> {
  const db = await getDb();
  const updated: StoredDocument = {
    ...doc,
    updatedAt: Date.now(),
  };
  await db.put("documents", updated);
  await recordStudyActivity();
  return updated;
}

export async function renameDocument(id: string, newTitle: string): Promise<StoredDocument | null> {
  const db = await getDb();
  const existing = await db.get("documents", id);
  if (!existing) return null;
  const trimmed = newTitle.trim();
  if (!trimmed) return existing;
  const updated: StoredDocument = {
    ...existing,
    title: trimmed,
    updatedAt: Date.now(),
  };
  await db.put("documents", updated);
  return updated;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("documents", id);
}

export async function recordStudyActivity(): Promise<GlobalStudyStats> {
  const db = await getDb();
  const today = todayKey();
  const current = (await db.get("stats", "global")) ?? {
    id: "global" as const,
    activeDates: [],
    totalStudyEvents: 0,
  };

  const dateSet = new Set(current.activeDates);
  dateSet.add(today);
  const updated: GlobalStudyStats = {
    id: "global",
    activeDates: Array.from(dateSet).sort(),
    totalStudyEvents: current.totalStudyEvents + 1,
  };
  await db.put("stats", updated);
  return updated;
}

export async function getGlobalStats(): Promise<GlobalStudyStats> {
  const db = await getDb();
  return (
    (await db.get("stats", "global")) ?? {
      id: "global",
      activeDates: [],
      totalStudyEvents: 0,
    }
  );
}

export function calculateDailyStreak(activeDates: string[]): number {
  if (activeDates.length === 0) return 0;
  const dateSet = new Set(activeDates);

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  const formatLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Allow streak to stay alive if user studied either today OR yesterday
  if (!dateSet.has(formatLocal(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dateSet.has(formatLocal(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (dateSet.has(formatLocal(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
