import type { Locale } from "@/lib/i18n/dictionaries";
import type { QuizDifficulty, SummaryMode } from "@/lib/ai/schemas";

const LANGUAGE_DIRECTIVE: Record<Locale, string> = {
  id: "Gunakan Bahasa Indonesia yang baku, jelas, ramah mahasiswa/pelajar, namun tetap akurat secara akademik.",
  en: "Use clear, accurate, student-friendly academic English.",
};

const SUMMARY_MODE_DIRECTIVES: Record<SummaryMode, Record<Locale, string>> = {
  paragraph: {
    id: `Format: **Paragraf Singkat Terstruktur**.
- Susun menjadi 3–5 paragraf ringkas yang mengalir logis.
- Beri subjudul pendek di atas tiap bagian utama.
- Tebalkan (**bold**) istilah kunci dan sertakan sitasi halaman seperti [Hal. 2] di akhir klaim penting.`,
    en: `Format: **Concise Structured Paragraphs**.
- Write 3–5 cohesive, well-paced paragraphs.
- Include brief section subheadings.
- **Bold** key terminology and attach page citations like [Page 2] to major claims.`,
  },
  bullets: {
    id: `Format: **Poin-Poin Penting (Bullet Points)**.
- Kelompokkan per topik/bab dengan heading \`###\`.
- Gunakan bullet singkat, padat, mudah dipindai di layar HP.
- Soroti definisi utama, rumus/mekanisme, serta kesimpulan penting lengkap dengan sitasi [Hal. X].`,
    en: `Format: **Structured Bullet Points**.
- Group by topic/chapter using \`###\` headings.
- Keep bullets punchy and scannable on mobile screens.
- Highlight core definitions, formulas/mechanisms, and takeaways with [Page X] citations.`,
  },
  table: {
    id: `Format: **Tabel Perbandingan Markdown**.
- Buat ringkasan pembuka 2 kalimat, lalu sajikan **1 hingga 2 tabel perbandingan Markdown (GFM)** dengan maksimal 3–4 kolom padat agar nyaman dibaca di layar HP.
- Bandingkan konsep, tahapan, rumus, atau klasifikasi utama yang ada di dokumen.
- Akhiri dengan bagian "Intisari Cepat" berupa 3–4 poin kesimpulan beserta referensi [Hal. X].`,
    en: `Format: **Markdown Comparison Table**.
- Start with a 2-sentence overview, then present **1 to 2 clean GFM Markdown comparison tables** (keep to 3–4 concise columns so mobile reading stays crisp).
- Contrast key concepts, stages, mechanisms, or classifications from the document.
- Conclude with 3–4 "Quick Takeaways" citing [Page X].`,
  },
  analogy: {
    id: `Format: **Analogi Sederhana Sehari-hari**.
- Jelaskan konsep-konsep tersulit di dokumen menggunakan perumpamaan kehidupan sehari-hari yang dekat dengan pelajar Indonesia (mis. dapur, lalu lintas, tim olahraga, pabrik, atau organisasi sekolah).
- Untuk setiap konsep utama: sebutkan **Konsep Asli [Hal. X]**, **Analogi Sederhana**, lalu **Mengapa Analogi Ini Cocok (Makna Ilmiahnya)**.`,
    en: `Format: **Simple Everyday Analogies**.
- Explain the document's trickiest concepts using vivid everyday analogies (e.g., kitchen, city traffic, sports team, factory).
- For each major concept: present **Core Concept [Page X]**, **The Everyday Analogy**, and **How It Maps Back to the Real Science**.`,
  },
};

const QUIZ_DIFFICULTY_DIRECTIVES: Record<QuizDifficulty, Record<Locale, string>> = {
  easy: {
    id: "Tingkat Kesulitan: MUDAH (C1–C2 Mengingat & Memahami). Uji definisi inti, istilah dasar, dan fakta eksplisit dari materi.",
    en: "Difficulty: EASY (Bloom C1–C2 Recall & Comprehension). Test core definitions, fundamental concepts, and explicit facts.",
  },
  medium: {
    id: "Tingkat Kesulitan: MENENGAH (C3 Mengaplikasikan). Uji penerapan konsep, hubungan sebab-akibat, dan perbandingan mekanisme.",
    en: "Difficulty: MEDIUM (Bloom C3 Application). Test concept application, cause-and-effect relationships, and mechanism comparisons.",
  },
  hard: {
    id: "Tingkat Kesulitan: SULIT / HOTS (C4–C5 Menganalisis & Mengevaluasi, setara UTBK SNBT / ujian universitas). Gunakan skenario kasus atau eksperimen yang menuntut penalaran multi-langkah berdasarkan dokumen.",
    en: "Difficulty: HARD / HOTS (Bloom C4–C5 Analysis & Evaluation). Present realistic scenarios, experiments, or multi-step reasoning grounded in the text.",
  },
};

export function buildMapChunkSummaryPrompt(params: {
  documentTitle: string;
  chunkIndex: number;
  totalChunks: number;
  chunkText: string;
  locale: Locale;
}): string {
  return `You are dr.PdF, an academic study assistant.
${LANGUAGE_DIRECTIVE[params.locale]}

Condense segment ${params.chunkIndex + 1} of ${params.totalChunks} from "${params.documentTitle}".
Preserve ALL key facts, definitions, quantitative figures, comparisons, and exact [PAGE X] numbers so a downstream synthesis step loses zero academic substance.

DOCUMENT SEGMENT:
${params.chunkText}`;
}

export function buildSummaryPrompt(params: {
  documentTitle: string;
  contextText: string;
  mode: SummaryMode;
  extraInstructions?: string;
  locale: Locale;
}): string {
  const extra = params.extraInstructions?.trim()
    ? `\nUSER EXTRA INSTRUCTIONS:\n${params.extraInstructions.trim()}\n`
    : "";

  return `You are dr.PdF, an expert, encouraging study doctor helping students master academic documents.
${LANGUAGE_DIRECTIVE[params.locale]}

DOCUMENT TITLE: "${params.documentTitle}"

TASK:
Create an accurate, well-structured Markdown summary of the document below.
${SUMMARY_MODE_DIRECTIVES[params.mode][params.locale]}
${extra}
STRICT RULES:
- Base every point strictly on the provided document pages. Do not invent facts outside the text.
- Output clean GitHub-Flavored Markdown immediately (no code-fence wrapper around the whole response).
- Keep formatting clean and scannable on a 375px mobile screen.

DOCUMENT CONTENT (WITH PAGE MARKERS):
${params.contextText}`;
}

export function buildQuizPrompt(params: {
  documentTitle: string;
  contextText: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  locale: Locale;
}): string {
  return `You are dr.PdF, a rigorous yet supportive university & high-school exam designer.
${LANGUAGE_DIRECTIVE[params.locale]}

DOCUMENT TITLE: "${params.documentTitle}"

TASK:
Generate exactly ${params.questionCount} multiple-choice questions from the document below.
${QUIZ_DIFFICULTY_DIRECTIVES[params.difficulty][params.locale]}

STRICT RULES:
1. Every question MUST have 5 plausible options: A, B, C, D, and E. Do NOT include "A.", "B." prefixes inside the option text itself.
2. Distribute questions evenly across different pages/chapters of the document.
3. Distractors must be realistic academic misconceptions, not silly throwaways.
4. Provide a clear, educational \`explanation\` explaining why \`correctOption\` is right and briefly clarifying key distractors.
5. Set \`pageReference\` to the 1-based page number where the answer is found.

DOCUMENT CONTENT (WITH PAGE MARKERS):
${params.contextText}`;
}

export function buildFlashcardsPrompt(params: {
  documentTitle: string;
  contextText: string;
  cardCount: number;
  focusTopic?: string;
  locale: Locale;
}): string {
  const focus = params.focusTopic?.trim()
    ? `\nUSER TOPIC FOCUS: Prioritize concepts related to "${params.focusTopic.trim()}".\n`
    : "";

  return `You are dr.PdF, an active-recall & spaced-repetition learning specialist.
${LANGUAGE_DIRECTIVE[params.locale]}

DOCUMENT TITLE: "${params.documentTitle}"

TASK:
Create exactly ${params.cardCount} high-yield active-recall flashcards covering the most important concepts, terms, mechanisms, or formulas in the document.
${focus}
STRICT RULES:
1. \`term\`: Concise concept name or short recall prompt (2–8 words) suitable for a flashcard front AND a matching-game tile.
2. \`definition\`: Accurate, self-contained explanation (1–2 crisp sentences, max 40 words) suitable for quick mobile review and matching-game pairing without directly repeating the \`term\` word-for-word at the start.
3. \`hint\`: Short memory hook, keyword cue, or analogy (max 12 words).
4. \`pageReference\`: Exact 1-based page number from the document.

DOCUMENT CONTENT (WITH PAGE MARKERS):
${params.contextText}`;
}

export function buildChatPrompt(params: {
  documentTitle: string;
  relevantContext: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  latestQuestion: string;
  locale: Locale;
}): string {
  const citeExample = params.locale === "id" ? "[Hal. 3]" : "[Page 3]";
  const historyText = params.conversationHistory
    .slice(-8)
    .map((m) => `${m.role === "user" ? "STUDENT" : "DR.PDF"}: ${m.content}`)
    .join("\n\n");

  return `You are dr.PdF, a friendly, sharp study assistant answering questions strictly grounded in "${params.documentTitle}".
${LANGUAGE_DIRECTIVE[params.locale]}

CITATION & GROUNDING RULES:
1. Ground your answer in the RELEVANT DOCUMENT PAGES below.
2. Cite page numbers inline whenever referencing facts from the document, using exact bracket notation like ${citeExample} or ${params.locale === "id" ? "[Hal. 4, Hal. 7]" : "[Page 4, Page 7]"}.
3. If the user's question is not covered in the document, state clearly and politely what is missing from the PDF before offering brief general academic context labeled as outside the PDF.
4. Format nicely in Markdown (bold key terms, short bullet points when helpful).

RELEVANT DOCUMENT PAGES:
${params.relevantContext}

${historyText ? `PREVIOUS CONVERSATION:\n${historyText}\n` : ""}
STUDENT QUESTION:
${params.latestQuestion}`;
}
