import type { PageChunk } from "@/lib/ai/schemas";

/**
 * Threshold per chunk (~85k characters ≈ ~22k tokens).
 * Keeps individual requests snappy on Vercel Hobby serverless timeouts
 * while activating clean map-reduce on huge 60-300 page textbooks.
 */
export const MAX_DIRECT_CONTEXT_CHARS = 85_000;
export const MAP_CHUNK_TARGET_CHARS = 42_000;

export function formatPagesWithMarkers(pages: PageChunk[]): string {
  return pages
    .map((p) => `--- [PAGE ${p.pageNumber}] ---\n${p.text.trim()}`)
    .join("\n\n");
}

export function chunkPagesForMapReduce(
  pages: PageChunk[],
  maxCharsPerChunk: number = MAP_CHUNK_TARGET_CHARS
): string[] {
  const chunks: string[] = [];
  let currentBuffer: string[] = [];
  let currentLen = 0;

  for (const page of pages) {
    const formatted = `--- [PAGE ${page.pageNumber}] ---\n${page.text.trim()}`;
    if (currentLen + formatted.length > maxCharsPerChunk && currentBuffer.length > 0) {
      chunks.push(currentBuffer.join("\n\n"));
      currentBuffer = [formatted];
      currentLen = formatted.length;
    } else {
      currentBuffer.push(formatted);
      currentLen += formatted.length;
    }
  }

  if (currentBuffer.length > 0) {
    chunks.push(currentBuffer.join("\n\n"));
  }

  return chunks;
}

const STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "ini", "itu", "apa", "bagaimana", "mengapa",
  "jelaskan", "sebutkan", "pada", "untuk", "dengan", "atau", "adalah", "dalam",
  "the", "and", "for", "with", "what", "how", "why", "explain", "from", "this",
  "that", "are", "was", "were", "about", "into", "antara", "tentang", "buatkan",
]);

function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Selects the most relevant pages for Q&A chat using BM25-inspired keyword scoring,
 * while always preserving document overview context if total size fits comfortably.
 */
export function selectRelevantPagesForChat(
  pages: PageChunk[],
  query: string,
  maxCharsBudget: number = 65_000
): string {
  const fullFormatted = formatPagesWithMarkers(pages);
  if (fullFormatted.length <= maxCharsBudget) {
    return fullFormatted;
  }

  const terms = tokenizeQuery(query);
  // Check explicit page mentions e.g. "halaman 5" or "page 12" or "hal 3"
  const pageMentions = new Set<number>();
  const pageRegex = /(?:halaman|hal\.?|page|p\.?)\s*(\d{1,4})/gi;
  let match: RegExpExecArray | null;
  while ((match = pageRegex.exec(query)) !== null) {
    pageMentions.add(Number(match[1]));
  }

  const scored = pages.map((p) => {
    const lower = p.text.toLowerCase();
    let score = pageMentions.has(p.pageNumber) ? 100 : 0;
    for (const term of terms) {
      let idx = 0;
      let occurrences = 0;
      while ((idx = lower.indexOf(term, idx)) !== -1) {
        occurrences++;
        idx += term.length;
      }
      if (occurrences > 0) {
        score += 3 + Math.min(occurrences, 8);
      }
    }
    // Slight bonus for first page (table of contents / intro)
    if (p.pageNumber === 1) score += 1.5;
    return { page: p, score };
  });

  scored.sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);

  const selected: PageChunk[] = [];
  let usedChars = 0;
  for (const item of scored) {
    const entryLen = item.page.text.length + 32;
    if (usedChars + entryLen > maxCharsBudget && selected.length >= 3) {
      break;
    }
    selected.push(item.page);
    usedChars += entryLen;
  }

  selected.sort((a, b) => a.pageNumber - b.pageNumber);
  return formatPagesWithMarkers(selected);
}
