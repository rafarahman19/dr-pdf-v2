import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { AiServiceError, classifyGeminiError } from "@/lib/ai/client";

const MAX_PAYLOAD_BYTES = 4_000_000; // 4 MB JSON safety ceiling

export async function validateAiRequest<T>(
  req: NextRequest,
  schema: z.ZodType<T>
): Promise<{ data: T } | { response: NextResponse }> {
  const rl = checkRateLimit(req);
  if (!rl.allowed) {
    return {
      response: NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please wait before trying again.",
            retryAfterSeconds: rl.retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfterSeconds),
          },
        }
      ),
    };
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return {
      response: NextResponse.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Extracted text exceeds maximum payload size.",
          },
        },
        { status: 413 }
      ),
    };
  }

  try {
    const parsedJson: unknown = JSON.parse(rawBody);
    const validated = schema.parse(parsedJson);
    return { data: validated };
  } catch (err) {
    const message =
      err instanceof ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : "Invalid JSON payload.";
    return {
      response: NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message,
          },
        },
        { status: 400 }
      ),
    };
  }
}

export function handleAiRouteError(err: unknown): NextResponse {
  const classified: AiServiceError = classifyGeminiError(err);
  return NextResponse.json(
    {
      error: {
        code: classified.code,
        message: classified.message,
      },
    },
    { status: classified.status }
  );
}
