import type { NextRequest } from "next/server";
import { SummaryRequestSchema } from "@/lib/ai/schemas";
import { validateAiRequest, handleAiRouteError } from "@/lib/ai/http";
import {
  prepareDocumentContext,
  resolveApiKey,
  streamGeminiMarkdown,
} from "@/lib/ai/client";
import { buildSummaryPrompt } from "@/lib/ai/prompts";
import {
  buildDemoSummaryMarkdown,
  createSimulatedTextStream,
} from "@/lib/ai/demo-fallback";

export async function POST(req: NextRequest) {
  const checked = await validateAiRequest(req, SummaryRequestSchema);
  if ("response" in checked) return checked.response;
  const body = checked.data;

  if (body.demoMode) {
    const md = buildDemoSummaryMarkdown({
      documentTitle: body.documentTitle,
      pages: body.pages,
      mode: body.mode,
      extraInstructions: body.extraInstructions,
      locale: body.locale,
    });
    return new Response(createSimulatedTextStream(md), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const apiKey = resolveApiKey(req);
    const contextText = await prepareDocumentContext({
      apiKey,
      documentTitle: body.documentTitle,
      pages: body.pages,
      locale: body.locale,
    });

    const prompt = buildSummaryPrompt({
      documentTitle: body.documentTitle,
      contextText,
      mode: body.mode,
      extraInstructions: body.extraInstructions,
      locale: body.locale,
    });

    const stream = await streamGeminiMarkdown({
      apiKey,
      prompt,
      temperature: 0.35,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleAiRouteError(err);
  }
}
