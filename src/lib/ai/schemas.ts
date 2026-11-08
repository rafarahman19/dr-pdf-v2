import { z } from "zod";
import { Type, type Schema } from "@google/genai";

export const PageChunkSchema = z.object({
  pageNumber: z.number().int().min(1).max(2000),
  text: z.string().max(50000),
});

export type PageChunk = z.infer<typeof PageChunkSchema>;

export const SummaryModeSchema = z.enum([
  "paragraph",
  "bullets",
  "table",
  "analogy",
]);
export type SummaryMode = z.infer<typeof SummaryModeSchema>;

export const QuizDifficultySchema = z.enum(["easy", "medium", "hard"]);
export type QuizDifficulty = z.infer<typeof QuizDifficultySchema>;

export const LocaleSchema = z.enum(["id", "en"]).default("id");

// --- Request Validation Schemas ---

const PagesArraySchema = z
  .array(PageChunkSchema)
  .min(1, "Document must contain at least 1 page.")
  .max(300, "Document exceeds the 300-page safety limit.");

export const SummaryRequestSchema = z.object({
  documentTitle: z.string().min(1).max(240),
  pages: PagesArraySchema,
  mode: SummaryModeSchema,
  extraInstructions: z.string().max(600).optional().default(""),
  locale: LocaleSchema,
  demoMode: z.boolean().optional().default(false),
});

export const QuizRequestSchema = z.object({
  documentTitle: z.string().min(1).max(240),
  pages: PagesArraySchema,
  difficulty: QuizDifficultySchema,
  questionCount: z.number().int().min(3).max(20),
  locale: LocaleSchema,
  demoMode: z.boolean().optional().default(false),
});

export const FlashcardsRequestSchema = z.object({
  documentTitle: z.string().min(1).max(240),
  pages: PagesArraySchema,
  cardCount: z.number().int().min(4).max(30),
  focusTopic: z.string().max(300).optional().default(""),
  locale: LocaleSchema,
  demoMode: z.boolean().optional().default(false),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
});

export const ChatRequestSchema = z.object({
  documentTitle: z.string().min(1).max(240),
  pages: PagesArraySchema,
  messages: z.array(ChatMessageSchema).min(1).max(30),
  locale: LocaleSchema,
  demoMode: z.boolean().optional().default(false),
});

// --- Structured Output Schemas (Zod + @google/genai Type) ---

export const QuizOptionKeySchema = z.enum(["A", "B", "C", "D", "E"]);
export type QuizOptionKey = z.infer<typeof QuizOptionKeySchema>;

export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(5),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
    E: z.string().min(1),
  }),
  correctOption: QuizOptionKeySchema,
  explanation: z.string().min(10),
  pageReference: z.number().int().min(1).optional(),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1),
});

export const geminiQuizResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "Multiple-choice questions with 5 options A through E.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier such as q1, q2, etc.",
          },
          question: {
            type: Type.STRING,
            description: "Clear question stem grounded in the document.",
          },
          options: {
            type: Type.OBJECT,
            properties: {
              A: { type: Type.STRING, description: "Option A text (without 'A.' prefix)" },
              B: { type: Type.STRING, description: "Option B text (without 'B.' prefix)" },
              C: { type: Type.STRING, description: "Option C text (without 'C.' prefix)" },
              D: { type: Type.STRING, description: "Option D text (without 'D.' prefix)" },
              E: { type: Type.STRING, description: "Option E text (without 'E.' prefix)" },
            },
            required: ["A", "B", "C", "D", "E"],
          },
          correctOption: {
            type: Type.STRING,
            enum: ["A", "B", "C", "D", "E"],
            description: "Exact letter of the single correct option.",
          },
          explanation: {
            type: Type.STRING,
            description:
              "Educational explanation of why the correct option is right and why distractors are wrong.",
          },
          pageReference: {
            type: Type.INTEGER,
            description: "1-based page number where the concept is discussed.",
          },
        },
        required: [
          "id",
          "question",
          "options",
          "correctOption",
          "explanation",
          "pageReference",
        ],
      },
    },
  },
  required: ["questions"],
};

export const FlashcardItemSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(2),
  definition: z.string().min(5),
  hint: z.string().optional().default(""),
  pageReference: z.number().int().min(1).optional(),
});

export type FlashcardItem = z.infer<typeof FlashcardItemSchema>;

export const FlashcardsResponseSchema = z.object({
  cards: z.array(FlashcardItemSchema).min(1),
});

export const geminiFlashcardsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      description: "Active recall flashcards pairing concise terms/prompts with clear definitions.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique card identifier such as fc1, fc2, etc.",
          },
          term: {
            type: Type.STRING,
            description: "Concise key term, concept name, or active-recall prompt (max 10 words).",
          },
          definition: {
            type: Type.STRING,
            description: "Clear, self-contained explanation or answer (1-3 sentences).",
          },
          hint: {
            type: Type.STRING,
            description: "Short mnemonic or cue without giving away the entire answer.",
          },
          pageReference: {
            type: Type.INTEGER,
            description: "1-based page number from the source document.",
          },
        },
        required: ["id", "term", "definition", "hint", "pageReference"],
      },
    },
  },
  required: ["cards"],
};
