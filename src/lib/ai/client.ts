import { GoogleGenAI, type Schema } from "@google/genai";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { PageChunk } from "@/lib/ai/schemas";
import {
  MAX_DIRECT_CONTEXT_CHARS,
  chunkPagesForMapReduce,
  formatPagesWithMarkers,
} from "@/lib/ai/chunker";
import { buildMapChunkSummaryPrompt } from "@/lib/ai/prompts";

/**
 * Primary active Gemini Flash model verified against ai.google.dev/gemini-api/docs/models.
 * Falls back gracefully to previous stable Flash generations if a user's API key tier restricts preview/new models.
 */
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash"];

export class AiServiceError extends Error {
  public readonly code:
    | "API_KEY_MISSING"
    | "QUOTA_EXHAUSTED"
    | "INVALID_API_KEY"
    | "UPSTREAM_ERROR";
  public readonly status: number;

  constructor(
    code: "API_KEY_MISSING" | "QUOTA_EXHAUSTED" | "INVALID_API_KEY" | "UPSTREAM_ERROR",
    message: string,
    status: number
  ) {
    super(message);
    this.name = "AiServiceError";
    this.code = code;
    this.status = status;
  }
}

export function resolveApiKey(req: NextRequest): string {
  const customHeaderKey = req.headers.get("x-custom-api-key")?.trim();
  if (customHeaderKey && customHeaderKey.length >= 16) {
    return customHeaderKey;
  }
  const serverKey = process.env.GEMINI_API_KEY?.trim();
  if (serverKey && serverKey.length >= 16 && !serverKey.includes("YOUR_")) {
    return serverKey;
  }
  throw new AiServiceError(
    "API_KEY_MISSING",
    "Gemini API key is not configured on the server and no fallback key was provided.",
    401
  );
}

export function classifyGeminiError(err: unknown): AiServiceError {
  if (err instanceof AiServiceError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  ) {
    return new AiServiceError(
      "QUOTA_EXHAUSTED",
      "Gemini API free quota exhausted. Try using your own API key in Settings.",
      429
    );
  }

  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission_denied")
  ) {
    return new AiServiceError(
      "INVALID_API_KEY",
      "The provided Gemini API key is invalid or unauthorized.",
      401
    );
  }

  return new AiServiceError(
    "UPSTREAM_ERROR",
    "Failed to generate response from Gemini AI. Please try again.",
    502
  );
}

function isModelNotFoundError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("404") || msg.includes("not found") || msg.includes("not supported");
}

function getCandidateModels(): string[] {
  const list = [DEFAULT_GEMINI_MODEL, ...FALLBACK_MODELS];
  return Array.from(new Set(list));
}

/**
 * Prepares document context with [PAGE X] markers.
 * Automatically runs parallel Map-Reduce chunk condensation if the PDF exceeds MAX_DIRECT_CONTEXT_CHARS.
 */
export async function prepareDocumentContext(params: {
  apiKey: string;
  documentTitle: string;
  pages: PageChunk[];
  locale: Locale;
}): Promise<string> {
  const direct = formatPagesWithMarkers(params.pages);
  if (direct.length <= MAX_DIRECT_CONTEXT_CHARS) {
    return direct;
  }

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const chunks = chunkPagesForMapReduce(params.pages);
  const models = getCandidateModels();

  const mapSummaries = await Promise.all(
    chunks.map(async (chunkText, idx) => {
      const prompt = buildMapChunkSummaryPrompt({
        documentTitle: params.documentTitle,
        chunkIndex: idx,
        totalChunks: chunks.length,
        chunkText,
        locale: params.locale,
      });

      let lastErr: unknown;
      for (const model of models) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0.2,
            },
          });
          return `=== CONDENSED PART ${idx + 1}/${chunks.length} ===\n${res.text ?? ""}`;
        } catch (err) {
          lastErr = err;
          if (!isModelNotFoundError(err)) break;
        }
      }
      throw classifyGeminiError(lastErr);
    })
  );

  return mapSummaries.join("\n\n");
}

export async function streamGeminiMarkdown(params: {
  apiKey: string;
  prompt: string;
  temperature?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const models = getCandidateModels();
  const encoder = new TextEncoder();

  let streamResult: AsyncGenerator<{ text?: string }> | null = null;
  let lastErr: unknown;

  for (const model of models) {
    try {
      const response = await ai.models.generateContentStream({
        model,
        contents: params.prompt,
        config: {
          temperature: params.temperature ?? 0.35,
        },
      });
      streamResult = response;
      break;
    } catch (err) {
      lastErr = err;
      if (!isModelNotFoundError(err)) break;
    }
  }

  if (!streamResult) {
    throw classifyGeminiError(lastErr);
  }

  const iterator = streamResult[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        if (value?.text) {
          controller.enqueue(encoder.encode(value.text));
        }
      } catch (err) {
        controller.error(classifyGeminiError(err));
      }
    },
  });
}

export async function generateGeminiStructured<T>(params: {
  apiKey: string;
  prompt: string;
  responseSchema: Schema;
  zodSchema: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const models = getCandidateModels();
  let lastErr: unknown;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
          temperature: params.temperature ?? 0.4,
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error("Empty structured response from Gemini.");
      }
      const parsedJson: unknown = JSON.parse(rawText);
      return params.zodSchema.parse(parsedJson);
    } catch (err) {
      lastErr = err;
      if (!isModelNotFoundError(err)) break;
    }
  }

  throw classifyGeminiError(lastErr);
}
