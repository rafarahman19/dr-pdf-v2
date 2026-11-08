import { NextResponse, type NextRequest } from "next/server";
import {
  FlashcardsRequestSchema,
  FlashcardsResponseSchema,
  geminiFlashcardsResponseSchema,
} from "@/lib/ai/schemas";
import { validateAiRequest, handleAiRouteError } from "@/lib/ai/http";
import {
  generateGeminiStructured,
  prepareDocumentContext,
  resolveApiKey,
} from "@/lib/ai/client";
import { buildFlashcardsPrompt } from "@/lib/ai/prompts";
import { buildDemoFlashcards } from "@/lib/ai/demo-fallback";

export async function POST(req: NextRequest) {
  const checked = await validateAiRequest(req, FlashcardsRequestSchema);
  if ("response" in checked) return checked.response;
  const body = checked.data;

  if (body.demoMode) {
    const cards = buildDemoFlashcards({
      pages: body.pages,
      cardCount: body.cardCount,
      locale: body.locale,
    });
    return NextResponse.json({ cards });
  }

  try {
    const apiKey = resolveApiKey(req);
    const contextText = await prepareDocumentContext({
      apiKey,
      documentTitle: body.documentTitle,
      pages: body.pages,
      locale: body.locale,
    });

    const prompt = buildFlashcardsPrompt({
      documentTitle: body.documentTitle,
      contextText,
      cardCount: body.cardCount,
      focusTopic: body.focusTopic,
      locale: body.locale,
    });

    const result = await generateGeminiStructured({
      apiKey,
      prompt,
      responseSchema: geminiFlashcardsResponseSchema,
      zodSchema: FlashcardsResponseSchema,
      temperature: 0.35,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleAiRouteError(err);
  }
}
