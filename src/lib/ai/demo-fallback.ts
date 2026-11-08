import type { Locale } from "@/lib/i18n/dictionaries";
import type {
  FlashcardItem,
  PageChunk,
  QuizDifficulty,
  QuizOptionKey,
  QuizQuestion,
  SummaryMode,
} from "@/lib/ai/schemas";

interface ExtractedSentence {
  pageNumber: number;
  heading: string;
  sentence: string;
}

function extractCleanSentences(pages: PageChunk[]): ExtractedSentence[] {
  const results: ExtractedSentence[] = [];
  for (const p of pages) {
    const lines = p.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !/^DR\.PDF SAMPLE/i.test(l) &&
          !/^Fakultas Ilmu/i.test(l) &&
          !/^Halaman \d+ dari \d+/i.test(l)
      );

    let currentHeading = lines[0]?.slice(0, 80) || `Bagian Halaman ${p.pageNumber}`;
    for (const line of lines) {
      if (/^(BAB\s+\d+|1?\d\.\d+\s+)/i.test(line)) {
        currentHeading = line.slice(0, 90);
        break;
      }
    }

    const bodyLines = lines.filter(
      (l) => !/^(BAB\s+\d+|\d+\.\d+\s+|Modul Kuliah|Klasifikasi|Koordinasi|Mitokondria, Kloroplas|Model Mosaik|Empat Tahapan|Regulasi Titik|Model Heliks|Aliran Informasi|Operon Lac|Segregasi, Asortasi|Aplikasi Rekayasa)/i.test(l)
    );
    const joined = (bodyLines.length > 0 ? bodyLines : lines).join(" ");
    const rawSentences = joined
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 45 && s.length <= 320);

    for (const s of rawSentences.slice(0, 5)) {
      results.push({
        pageNumber: p.pageNumber,
        heading: currentHeading,
        sentence: s,
      });
    }
  }
  return results;
}

export function buildDemoSummaryMarkdown(params: {
  documentTitle: string;
  pages: PageChunk[];
  mode: SummaryMode;
  extraInstructions?: string;
  locale: Locale;
}): string {
  const { documentTitle, pages, mode, extraInstructions, locale } = params;
  const cite = (n: number) => (locale === "id" ? `[Hal. ${n}]` : `[Page ${n}]`);
  const items = extractCleanSentences(pages);
  const byPage = new Map<number, ExtractedSentence[]>();
  for (const item of items) {
    const list = byPage.get(item.pageNumber) ?? [];
    list.push(item);
    byPage.set(item.pageNumber, list);
  }

  const pageEntries = Array.from(byPage.entries()).slice(0, 8);
  const noteBanner =
    locale === "id"
      ? `> *Mode Simulasi Ekstraktif Aktif — Disarikan langsung dari **${pages.length} halaman** dokumen "${documentTitle}".*`
      : `> *Extractive Simulation Mode Active — Distilled directly from **${pages.length} pages** of "${documentTitle}".*`;

  const extraLine = extraInstructions?.trim()
    ? locale === "id"
      ? `\n\n**Fokus Tambahan:** _${extraInstructions.trim()}_`
      : `\n\n**Custom Focus:** _${extraInstructions.trim()}_`
    : "";

  if (mode === "table") {
    const rows = pageEntries
      .map(([pageNum, list]) => {
        const topic = (list[0]?.heading || `Topik ${pageNum}`).replace(/\|/g, "/");
        const core = (list[0]?.sentence || "").slice(0, 130).replace(/\|/g, "/");
        const detail = (list[1]?.sentence || list[0]?.sentence || "")
          .slice(0, 110)
          .replace(/\|/g, "/");
        return `| **${topic}** ${cite(pageNum)} | ${core} | ${detail} |`;
      })
      .join("\n");

    const header =
      locale === "id"
        ? `| Topik / Bab | Konsep Kunci | Detail & Mekanisme |\n| :--- | :--- | :--- |`
        : `| Topic / Section | Core Concept | Key Mechanism & Detail |\n| :--- | :--- | :--- |`;

    const takeaways = pageEntries
      .slice(0, 4)
      .map(([pageNum, list]) => `- **${list[0]?.heading}**: ${list[0]?.sentence} ${cite(pageNum)}`)
      .join("\n");

    return `${noteBanner}${extraLine}\n\n### ${
      locale === "id" ? "Tabel Perbandingan Materi Utama" : "Core Material Comparison Table"
    }\n\n${header}\n${rows}\n\n### ${
      locale === "id" ? "Intisari Cepat" : "Quick Takeaways"
    }\n${takeaways}`;
  }

  if (mode === "bullets") {
    const sections = pageEntries
      .map(([pageNum, list]) => {
        const bullets = list
          .slice(0, 2)
          .map((x) => `- ${x.sentence} ${cite(pageNum)}`)
          .join("\n");
        return `### ${list[0]?.heading}\n${bullets}`;
      })
      .join("\n\n");
    return `${noteBanner}${extraLine}\n\n${sections}`;
  }

  if (mode === "analogy") {
    const analogies = [
      locale === "id"
        ? "Bayangkan seperti **sistem manajemen pabrik modern** di mana ruang kendali pusat mengirim cetak biru kerja ke lini produksi khusus agar setiap komponen dirakit tepat waktu."
        : "Think of this like a **modern smart factory** where central headquarters dispatches blueprints to specialized assembly lines.",
      locale === "id"
        ? "Ibarat **gerbang tol otomatis dengan kartu akses selektif**: jalur ekspres membiarkan kendaraan kecil lewat bebas, sedangkan muatan khusus memerlukan tiket energi."
        : "Picture an **automated tollgate with selective access passes**: small commuters cruise freely while heavy cargo requires an energy ticket.",
      locale === "id"
        ? "Seperti **buku resep keluarga yang difotokopi per halaman** sebelum dibawa ke dapur, sehingga buku induk tetap aman di lemari arsip."
        : "Just like **photocopying a single recipe card** for the busy kitchen so the master cookbook stays safe in the vault.",
      locale === "id"
        ? "Serupa dengan **tim estafet profesional** di mana setiap pelari menyerahkan tongkat energi secara presisi menuju garis akhir."
        : "Like a **precision relay team** handing off energy batons cleanly from one stage to the finish line.",
    ];
    const blocks = pageEntries
      .slice(0, 4)
      .map(([pageNum, list], idx) => {
        const analogyText = analogies[idx % analogies.length];
        return `### ${idx + 1}. ${list[0]?.heading} ${cite(pageNum)}\n- **${
          locale === "id" ? "Konsep Ilmiah" : "Core Concept"
        }:** ${list[0]?.sentence}\n- **${
          locale === "id" ? "Analogi Sehari-hari" : "Everyday Analogy"
        }:** ${analogyText}`;
      })
      .join("\n\n");
    return `${noteBanner}${extraLine}\n\n${blocks}`;
  }

  // Default: paragraph mode
  const paragraphs = pageEntries
    .slice(0, 5)
    .map(([pageNum, list]) => {
      const combined = list
        .slice(0, 2)
        .map((x) => x.sentence)
        .join(" ");
      return `### ${list[0]?.heading}\n${combined} ${cite(pageNum)}`;
    })
    .join("\n\n");

  return `${noteBanner}${extraLine}\n\n${paragraphs}`;
}

export function buildDemoQuiz(params: {
  pages: PageChunk[];
  difficulty: QuizDifficulty;
  questionCount: number;
  locale: Locale;
}): QuizQuestion[] {
  const { pages, difficulty, questionCount, locale } = params;
  const sentences = extractCleanSentences(pages);
  const pool =
    sentences.length >= 5
      ? sentences
      : pages.map((p) => ({
          pageNumber: p.pageNumber,
          heading: `Halaman ${p.pageNumber}`,
          sentence: p.text.slice(0, 180).trim() || `Materi utama halaman ${p.pageNumber}`,
        }));

  const optionKeys: QuizOptionKey[] = ["A", "B", "C", "D", "E"];
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < questionCount; i++) {
    const target = pool[(i * 2) % pool.length]!;
    const correctKey = optionKeys[i % 5]!;

    const distractors: string[] = [];
    for (let offset = 1; distractors.length < 4; offset++) {
      const other = pool[(i * 2 + offset * 3) % pool.length];
      const candidate =
        other && other.sentence !== target.sentence
          ? other.sentence.slice(0, 140)
          : locale === "id"
            ? `Mekanisme alternatif yang tidak terjadi pada ${target.heading.toLowerCase()} (opsi pengecoh ${offset}).`
            : `Alternative mechanism unrelated to ${target.heading} (distractor ${offset}).`;
      if (!distractors.includes(candidate)) {
        distractors.push(candidate);
      }
    }

    const stemPrefix =
      difficulty === "hard"
        ? locale === "id"
          ? `[HOTS] Berdasarkan analisis konsep pada "${target.heading}", pernyataan manakah yang paling akurat menggambarkan mekanisme utamanya?`
          : `[HOTS] Analyzing "${target.heading}", which statement accurately synthesizes its primary mechanism?`
        : difficulty === "medium"
          ? locale === "id"
            ? `Manakah pernyataan yang tepat mengenai "${target.heading}" sesuai materi dokumen?`
            : `Which statement accurately describes "${target.heading}" according to the document?`
          : locale === "id"
            ? `Berdasarkan halaman ${target.pageNumber}, manakah fakta dasar yang benar tentang "${target.heading}"?`
            : `Based on page ${target.pageNumber}, which core fact is true regarding "${target.heading}"?`;

    const optionsMap: Record<QuizOptionKey, string> = {
      A: "",
      B: "",
      C: "",
      D: "",
      E: "",
    };
    let dIdx = 0;
    for (const key of optionKeys) {
      if (key === correctKey) {
        optionsMap[key] = target.sentence.slice(0, 165);
      } else {
        optionsMap[key] = distractors[dIdx++]!;
      }
    }

    questions.push({
      id: `q-${i + 1}`,
      question: stemPrefix,
      options: optionsMap,
      correctOption: correctKey,
      explanation:
        locale === "id"
          ? `Opsi ${correctKey} benar karena sesuai dengan uraian pada Halaman ${target.pageNumber} (${target.heading}): "${target.sentence}". Pilihan lainnya merujuk pada bagian atau mekanisme berbeda di dalam modul.`
          : `Option ${correctKey} is correct as stated on Page ${target.pageNumber} (${target.heading}): "${target.sentence}". Other options describe unrelated sections of the document.`,
      pageReference: target.pageNumber,
    });
  }

  return questions;
}

export function buildDemoFlashcards(params: {
  pages: PageChunk[];
  cardCount: number;
  locale: Locale;
}): FlashcardItem[] {
  const { pages, cardCount, locale } = params;
  const sentences = extractCleanSentences(pages);
  const cards: FlashcardItem[] = [];

  for (let i = 0; i < cardCount; i++) {
    const item = sentences[i % Math.max(1, sentences.length)];
    if (!item) break;

    // Extract clean term from heading or bold/capitalized phrase
    const cleanedHeading = item.heading
      .replace(/^(BAB\s+\d+:\s*|\d+\.\d+\s*)/i, "")
      .trim();
    const firstWords = item.sentence.split(/\s+/).slice(0, 3).join(" ").replace(/[,.:;]/g, "");
    const term =
      i < pages.length && cleanedHeading.length >= 4
        ? cleanedHeading.slice(0, 52)
        : `${firstWords} (Hal. ${item.pageNumber})`;

    cards.push({
      id: `fc-${i + 1}`,
      term,
      definition: item.sentence.slice(0, 210),
      hint:
        locale === "id"
          ? `Lihat pembahasan di Halaman ${item.pageNumber}`
          : `Review section on Page ${item.pageNumber}`,
      pageReference: item.pageNumber,
    });
  }

  return cards;
}

export function buildDemoChatAnswer(params: {
  documentTitle: string;
  pages: PageChunk[];
  question: string;
  locale: Locale;
}): string {
  const { documentTitle, pages, question, locale } = params;
  const qWords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const scored = pages
    .map((p) => {
      const lower = p.text.toLowerCase();
      let score = 0;
      for (const w of qWords) {
        if (lower.includes(w)) score += 4;
      }
      return { page: p, score };
    })
    .sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);

  const topPages = scored.slice(0, 3).map((s) => s.page);
  const snippets = extractCleanSentences(topPages).slice(0, 4);
  const cite = (n: number) => (locale === "id" ? `[Hal. ${n}]` : `[Page ${n}]`);

  if (locale === "id") {
    const bullets = snippets
      .map((s) => `- **${s.heading}**: ${s.sentence} ${cite(s.pageNumber)}`)
      .join("\n");
    return `Berdasarkan analisis materi pada **${documentTitle}**, berikut poin relevan untuk pertanyaanmu:\n\n${bullets}\n\n> *Catatan: Jawaban ini dihasilkan melalui Mode Simulasi Lokal dengan mengutip langsung halaman terkait.*`;
  }

  const bullets = snippets
    .map((s) => `- **${s.heading}**: ${s.sentence} ${cite(s.pageNumber)}`)
    .join("\n");
  return `Based on **${documentTitle}**, here are the key points addressing your question:\n\n${bullets}\n\n> *Note: Generated via Local Simulation Mode with direct page citations.*`;
}

export function createSimulatedTextStream(fullText: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = fullText.match(/[\s\S]{1,36}(\s|$)/g) ?? [fullText];
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      await new Promise((r) => setTimeout(r, 18));
      controller.enqueue(encoder.encode(chunks[index++]));
    },
  });
}
