import type { NextRequest } from "next/server";

interface RateBucket {
  timestamps: number[];
}

const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20;

const buckets = new Map<string, RateBucket>();

function cleanupExpired(now: number) {
  if (buckets.size < 200) return;
  for (const [key, bucket] of buckets.entries()) {
    const active = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
    if (active.length === 0) {
      buckets.delete(key);
    } else {
      bucket.timestamps = active;
    }
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "anonymous";
  }
  return req.headers.get("x-real-ip") ?? "local-client";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(req: NextRequest): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const ip = getClientIp(req);
  const existing = buckets.get(ip) ?? { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((t) => now - t < WINDOW_MS);

  if (existing.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = existing.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - oldest)) / 1000)
    );
    buckets.set(ip, existing);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.timestamps.push(now);
  buckets.set(ip, existing);
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - existing.timestamps.length,
    retryAfterSeconds: 0,
  };
}
