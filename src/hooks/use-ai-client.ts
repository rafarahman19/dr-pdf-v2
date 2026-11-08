"use client";

import { useCallback } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";

export interface FriendlyAiError {
  code:
    | "API_KEY_MISSING"
    | "QUOTA_EXHAUSTED"
    | "INVALID_API_KEY"
    | "RATE_LIMITED"
    | "OFFLINE"
    | "UPSTREAM_ERROR";
  message: string;
}

export function useAiClient() {
  const { customApiKey, demoMode, t } = useAppSettings();

  const buildHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey) {
      headers["x-custom-api-key"] = customApiKey;
    }
    return headers;
  }, [customApiKey]);

  const mapResponseError = useCallback(
    async (res: Response): Promise<FriendlyAiError> => {
      let code: FriendlyAiError["code"] = "UPSTREAM_ERROR";
      let serverMsg = "";
      try {
        const json = (await res.json()) as {
          error?: { code?: string; message?: string };
        };
        const rawCode = json.error?.code;
        serverMsg = json.error?.message ?? "";
        if (
          rawCode === "API_KEY_MISSING" ||
          rawCode === "QUOTA_EXHAUSTED" ||
          rawCode === "INVALID_API_KEY" ||
          rawCode === "RATE_LIMITED"
        ) {
          code = rawCode;
        }
      } catch {
        // Non-JSON error body
      }

      if (code === "API_KEY_MISSING" || code === "INVALID_API_KEY") {
        return { code, message: t.errors.missingApiKey };
      }
      if (code === "QUOTA_EXHAUSTED") {
        return { code, message: t.errors.quotaExhausted };
      }
      if (code === "RATE_LIMITED") {
        return { code, message: t.errors.rateLimited };
      }
      return {
        code: "UPSTREAM_ERROR",
        message: serverMsg || "Gagal memproses permintaan AI.",
      };
    },
    [t]
  );

  const postStream = useCallback(
    async (
      endpoint: string,
      payload: Record<string, unknown>,
      onDelta: (accumulated: string) => void,
      options?: { forceDemo?: boolean; signal?: AbortSignal }
    ): Promise<string> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw {
          code: "OFFLINE",
          message: t.errors.networkOffline,
        } satisfies FriendlyAiError;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          ...payload,
          demoMode: Boolean(options?.forceDemo || demoMode),
        }),
        signal: options?.signal,
      });

      if (!res.ok || !res.body) {
        throw await mapResponseError(res);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          full += decoder.decode(value, { stream: true });
          onDelta(full);
        }
      }
      full += decoder.decode();
      onDelta(full);
      return full;
    },
    [buildHeaders, demoMode, mapResponseError, t]
  );

  const postJson = useCallback(
    async <T>(
      endpoint: string,
      payload: Record<string, unknown>,
      options?: { forceDemo?: boolean; signal?: AbortSignal }
    ): Promise<T> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw {
          code: "OFFLINE",
          message: t.errors.networkOffline,
        } satisfies FriendlyAiError;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          ...payload,
          demoMode: Boolean(options?.forceDemo || demoMode),
        }),
        signal: options?.signal,
      });

      if (!res.ok) {
        throw await mapResponseError(res);
      }

      return (await res.json()) as T;
    },
    [buildHeaders, demoMode, mapResponseError, t]
  );

  return { postStream, postJson };
}
