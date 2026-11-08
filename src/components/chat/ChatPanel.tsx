"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiErrorBanner } from "@/components/ui/ai-error-banner";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { StoredChatMessage, StoredDocument } from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useAiClient, type FriendlyAiError } from "@/hooks/use-ai-client";

interface ChatPanelProps {
  doc: StoredDocument;
  onUpdateDocument: (updated: StoredDocument) => Promise<void>;
}

function extractCitedPages(text: string, maxPage: number): number[] {
  const found = new Set<number>();
  const regex = /\[(?:Hal\.?|Halaman|Page|p\.?)\s*(\d{1,4})(?:[,;\s]+(?:Hal\.?|Page|p\.?)?\s*(\d{1,4}))?\]/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const p1 = Number(match[1]);
    if (p1 >= 1 && p1 <= maxPage) found.add(p1);
    if (match[2]) {
      const p2 = Number(match[2]);
      if (p2 >= 1 && p2 <= maxPage) found.add(p2);
    }
  }
  return Array.from(found).sort((a, b) => a - b);
}

export function ChatPanel({ doc, onUpdateDocument }: ChatPanelProps) {
  const { locale, t } = useAppSettings();
  const { postStream } = useAiClient();

  const [messages, setMessages] = useState<StoredChatMessage[]>(
    doc.chatMessages ?? []
  );
  const [input, setInput] = useState<string>("");
  const [streamingReply, setStreamingReply] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<FriendlyAiError | null>(null);
  const [lastPendingQuestion, setLastPendingQuestion] = useState<string>("");
  const [inspectedPage, setInspectedPage] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, streamingReply]);

  const sendQuestion = useCallback(
    async (questionText: string, forceDemo = false) => {
      const trimmed = questionText.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setLastPendingQuestion(trimmed);
      setInput("");

      const userMsg: StoredChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      const baseHistory =
        forceDemo &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === "user" &&
        messages[messages.length - 1]?.content === trimmed
          ? messages
          : [...messages, userMsg];

      setMessages(baseHistory);
      setIsStreaming(true);
      setStreamingReply("");

      try {
        const finalAnswer = await postStream(
          "/api/ai/chat",
          {
            documentTitle: doc.title,
            pages: doc.pages,
            messages: baseHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            locale,
          },
          (partial) => {
            setStreamingReply(partial);
          },
          { forceDemo }
        );

        const assistantMsg: StoredChatMessage = {
          id: `msg-a-${Date.now()}`,
          role: "assistant",
          content: finalAnswer,
          createdAt: Date.now(),
        };

        const updatedThread = [...baseHistory, assistantMsg];
        setMessages(updatedThread);
        setStreamingReply("");

        await onUpdateDocument({
          ...doc,
          chatMessages: updatedThread,
        });
      } catch (err) {
        setError(err as FriendlyAiError);
      } finally {
        setIsStreaming(false);
      }
    },
    [doc, isStreaming, locale, messages, onUpdateDocument, postStream]
  );

  const handleClearChat = async () => {
    setMessages([]);
    setStreamingReply("");
    setError(null);
    await onUpdateDocument({
      ...doc,
      chatMessages: [],
    });
  };

  const inspectedPageObj =
    inspectedPage !== null
      ? doc.pages.find((p) => p.pageNumber === inspectedPage)
      : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary shrink-0" />
                {t.chat.title}
              </CardTitle>
              <CardDescription className="mt-1">{t.chat.subtitle}</CardDescription>
            </div>
            {messages.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void handleClearChat()}
              >
                <Trash2 className="h-4 w-4" />
                {t.chat.clearBtn}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Starter Prompts when chat is empty */}
          {messages.length === 0 && !isStreaming && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-4 w-4" />
                {t.chat.startersTitle}
              </div>
              <div className="flex flex-col gap-2">
                {t.chat.starters.map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void sendQuestion(starter)}
                    className="min-h-11 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-sm font-medium hover:border-primary hover:bg-accent transition-all cursor-pointer"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          {messages.length > 0 && (
            <div className="max-h-[56dvh] overflow-y-auto space-y-3 pr-1">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const citedPages = !isUser
                  ? extractCitedPages(msg.content, doc.pageCount)
                  : [];

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="mt-1 hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[96%] sm:max-w-[84%] rounded-2xl px-3.5 sm:px-4 py-3 text-sm ${
                        isUser
                          ? "bg-primary text-primary-foreground font-medium"
                          : "border border-border bg-background/85 text-foreground"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <>
                          <MarkdownRenderer content={msg.content} />
                          {citedPages.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
                              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                              {citedPages.map((pNum) => (
                                <button
                                  key={pNum}
                                  type="button"
                                  onClick={() => setInspectedPage(pNum)}
                                  className="inline-flex min-h-8 items-center rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground hover:opacity-85 cursor-pointer"
                                >
                                  {t.chat.citationPrefix} {pNum}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming Assistant Bubble */}
              {isStreaming && (
                <div className="flex gap-2.5 justify-start">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[88%] rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm">
                    {streamingReply ? (
                      <MarkdownRenderer content={streamingReply} />
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>{t.chat.thinking}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          <AiErrorBanner
            error={error}
            onRetryWithDemo={
              lastPendingQuestion
                ? () => void sendQuestion(lastPendingQuestion, true)
                : undefined
            }
          />

          {/* Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion(input, false);
            }}
            className="flex items-end gap-2 pt-1"
          >
            <label htmlFor="pdf-chat-input" className="sr-only">
              {t.chat.inputPlaceholder}
            </label>
            <input
              id="pdf-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.chat.inputPlaceholder}
              disabled={isStreaming}
              className="min-h-12 flex-1 rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="submit"
              size="lg"
              disabled={!input.trim() || isStreaming}
              aria-label={t.chat.sendBtn}
              className="shrink-0 px-4"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <span className="hidden sm:inline">{t.chat.sendBtn}</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Cited Page Source Inspector Modal */}
      <Dialog
        open={inspectedPage !== null}
        onOpenChange={(o) => {
          if (!o) setInspectedPage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.upload.pageOf} {inspectedPage} — {doc.title}
            </DialogTitle>
            <DialogDescription>
              Kutipan teks asli yang diekstrak dari halaman {inspectedPage}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 rounded-xl border border-border bg-muted/50 p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap max-h-[55dvh] overflow-y-auto">
            {inspectedPageObj?.text || "-"}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
