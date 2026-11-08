import type { PageChunk } from "@/lib/ai/schemas";
import { estimateTokens } from "@/lib/utils";

export class ScannedPdfError extends Error {
  constructor(message = "Scanned PDF with no extractable text.") {
    super(message);
    this.name = "ScannedPdfError";
  }
}

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
}

export interface ExtractedPdfResult {
  pages: PageChunk[];
  pageCount: number;
  wordCount: number;
  estimatedTokens: number;
  totalChars: number;
}

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

export async function extractPdfInBrowser(
  input: File | ArrayBuffer,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractedPdfResult> {
  if (typeof window === "undefined") {
    throw new Error("PDF extraction must run in the browser.");
  }

  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const arrayBuffer =
    input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  if (totalPages === 0) {
    throw new ScannedPdfError("Empty PDF document.");
  }

  const pages: PageChunk[] = [];
  let totalAlphaNum = 0;
  let totalWords = 0;
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;

    for (const rawItem of textContent.items as PdfTextItemLike[]) {
      if (typeof rawItem.str !== "string") continue;
      const y = Array.isArray(rawItem.transform) ? rawItem.transform[5] ?? null : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = rawItem.str;
      } else {
        const needsSpace =
          currentLine.length > 0 &&
          !currentLine.endsWith(" ") &&
          !rawItem.str.startsWith(" ");
        currentLine += (needsSpace ? " " : "") + rawItem.str;
      }

      if (rawItem.hasEOL) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = "";
        lastY = null;
      } else {
        lastY = y;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    const pageText = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const alphaNumMatches = pageText.match(/[a-zA-Z0-9]/g);
    totalAlphaNum += alphaNumMatches ? alphaNumMatches.length : 0;

    const words = pageText ? pageText.split(/\s+/).filter(Boolean).length : 0;
    totalWords += words;
    totalChars += pageText.length;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });

    onProgress?.({
      currentPage: pageNum,
      totalPages,
      percent: Math.round((pageNum / totalPages) * 100),
    });

    // Yield briefly every 5 pages so mobile UI animation stays silky-smooth at 60fps
    if (pageNum % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Detect scanned / image-only PDFs with essentially zero selectable text
  const avgAlphaNumPerPage = totalAlphaNum / totalPages;
  if (totalAlphaNum < 35 || avgAlphaNumPerPage < 12) {
    throw new ScannedPdfError();
  }

  return {
    pages,
    pageCount: totalPages,
    wordCount: totalWords,
    estimatedTokens: estimateTokens(pages.map((p) => p.text).join("\n")),
    totalChars,
  };
}
