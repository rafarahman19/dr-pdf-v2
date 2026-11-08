import type { NextRequest } from "next/server";
import { ChatRequestSchema } from "@/lib/ai/schemas";
import { validateAiRequest, handleAiRouteError } from "@/lib/ai/http";
import { resolveApiKey, streamGeminiMarkdown } from "@/lib/ai/client";
import { selectRelevantPagesForChat } from "@/lib/ai/chunker";
import { buildChatPrompt } from "@/lib/ai/prompts";
import {
  buildDemoChatAnswer,
  createSimulatedTextStream,
} from "@/lib/ai/demo-fallback";

export async function POST(req: NextRequest) {
  const checked = await validateAiRequest(req, ChatRequestSchema);
  if ("response" in checked) return checked.response;
  const body = checked.data;

  const latestUserMsg =
    [...body.messages].reverse().find((m) => m.role === "user")?.content ??
    body.messages[body.messages.length - 1]!.content;

  if (body.demoMode) {
    const answer = buildDemoChatAnswer({
      documentTitle: body.documentTitle,
      pages: body.pages,
      question: latestUserMsg,
      locale: body.locale,
    });
    return new Response(createSimulatedTextStream(answer), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const apiKey = resolveApiKey(req);
    const relevantContext = selectRelevantPagesForChat(body.pages, latestUserMsg);

    const prompt = buildChatPrompt({
      documentTitle: body.documentTitle,
      relevantContext,
      conversationHistory: body.messages.slice(0, -1),
      latestQuestion: latestUserMsg,
      locale: body.locale,
    });

    const stream = await streamGeminiMarkdown({
      apiKey,
      prompt,
      temperature: 0.3,
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
