"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("drpdf-markdown max-w-full", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
              <table className="w-full min-w-[460px] border-collapse text-left text-xs sm:text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-accent text-accent-foreground border-b border-border">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2.5 font-bold whitespace-normal align-top">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-border/70 px-3 py-2.5 align-top leading-relaxed">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
