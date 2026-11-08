import { NextResponse, type NextRequest } from "next/server";
import {
  QuizRequestSchema,
  QuizResponseSchema,
  geminiQuizResponseSchema,
} from "@/lib/ai/schemas";
import { validateAiRequest, handleAiRouteError } from "@/lib/ai/http";
import {
  generateGeminiStructured,
  prepareDocumentContext,
  resolveApiKey,
} from "@/lib/ai/client";
import { buildQuizPrompt } from "@/lib/ai/prompts";
import { buildDemoQuiz } from "@/lib/ai/demo-fallback";

export async function POST(req: NextRequest) {
  const checked = await validateAiRequest(req, QuizRequestSchema);
  if ("response" in checked) return checked.response;
  const body = checked.data;

  if (body.demoMode) {
    const questions = buildDemoQuiz({
      pages: body.pages,
      difficulty: body.difficulty,
      questionCount: body.questionCount,
      locale: body.locale,
    });
    return NextResponse.json({ questions });
  }

  try {
    const apiKey = resolveApiKey(req);
    const contextText = await prepareDocumentContext({
      apiKey,
      documentTitle: body.documentTitle,
      pages: body.pages,
      locale: body.locale,
    });

    const prompt = buildQuizPrompt({
      documentTitle: body.documentTitle,
      contextText,
      difficulty: body.difficulty,
      questionCount: body.questionCount,
      locale: body.locale,
    });

    const result = await generateGeminiStructured({
      apiKey,
      prompt,
      responseSchema: geminiQuizResponseSchema,
      zodSchema: QuizResponseSchema,
      temperature: 0.4,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleAiRouteError(err);
  }
}
