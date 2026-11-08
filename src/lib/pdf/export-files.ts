import type { StoredDocument } from "@/lib/storage/db";
import type { Locale } from "@/lib/i18n/dictionaries";

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "drpdf-materi"
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAsMarkdown(doc: StoredDocument, locale: Locale = "id") {
  const sections: string[] = [];
  sections.push(`# ${doc.title}`);
  sections.push(
    `> Diekspor dari **dr.PdF v2** • ${doc.pageCount} ${
      locale === "id" ? "Halaman" : "Pages"
    } • ${new Date().toLocaleDateString(locale === "id" ? "id-ID" : "en-US")}\n`
  );

  if (doc.summary?.markdown) {
    sections.push(`## ${locale === "id" ? "Ringkasan Materi" : "Summary"}`);
    sections.push(doc.summary.markdown.trim());
    sections.push("");
  }

  if (doc.flashcards && doc.flashcards.length > 0) {
    sections.push(`## ${locale === "id" ? "Kartu Hafalan (Flashcards)" : "Flashcards"}`);
    sections.push(
      locale === "id"
        ? "| No | Istilah | Definisi | Ref |"
        : "| # | Term | Definition | Ref |"
    );
    sections.push("| :--- | :--- | :--- | :--- |");
    doc.flashcards.forEach((fc, idx) => {
      const term = fc.term.replace(/\|/g, "/");
      const def = fc.definition.replace(/\|/g, "/");
      const ref = fc.pageReference ? `Hal. ${fc.pageReference}` : "-";
      sections.push(`| ${idx + 1} | **${term}** | ${def} | ${ref} |`);
    });
    sections.push("");
  }

  if (doc.quiz && doc.quiz.questions.length > 0) {
    sections.push(
      `## ${locale === "id" ? "Latihan Soal Pilihan Ganda & Pembahasan" : "Practice Quiz & Answer Key"}`
    );
    doc.quiz.questions.forEach((q, idx) => {
      sections.push(`### ${idx + 1}. ${q.question}`);
      (["A", "B", "C", "D", "E"] as const).forEach((letter) => {
        sections.push(`- **${letter}.** ${q.options[letter]}`);
      });
      sections.push(
        `\n**${locale === "id" ? "Kunci Jawaban" : "Answer"}:** ${q.correctOption}${
          q.pageReference ? ` (Hal. ${q.pageReference})` : ""
        }`
      );
      sections.push(`**${locale === "id" ? "Pembahasan" : "Explanation"}:** ${q.explanation}\n`);
    });
  }

  const content = sections.join("\n");
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  triggerBlobDownload(blob, `${sanitizeFilename(doc.title)}-drpdf.md`);
}

function escapeCsvCell(value: string): string {
  const cleaned = value.replace(/\r?\n/g, " ").trim();
  if (/[",;]/.test(cleaned)) {
    return `"${cleaned.replace(/"/g, '""')}"`;
  }
  return `"${cleaned}"`;
}

export function exportAsAnkiCsv(doc: StoredDocument) {
  const rows: string[] = [];
  const tagSlug = sanitizeFilename(doc.title).replace(/-/g, "_");

  if (doc.flashcards && doc.flashcards.length > 0) {
    for (const fc of doc.flashcards) {
      const back = fc.pageReference
        ? `${fc.definition} (Ref: Hal. ${fc.pageReference})`
        : fc.definition;
      rows.push(
        [
          escapeCsvCell(fc.term),
          escapeCsvCell(back),
          escapeCsvCell(`drpdf ${tagSlug} flashcard`),
        ].join(",")
      );
    }
  }

  if (doc.quiz && doc.quiz.questions.length > 0) {
    for (const q of doc.quiz.questions) {
      const front = `${q.question} | A) ${q.options.A} | B) ${q.options.B} | C) ${q.options.C} | D) ${q.options.D} | E) ${q.options.E}`;
      const back = `${q.correctOption}. ${q.options[q.correctOption]} — ${q.explanation}`;
      rows.push(
        [
          escapeCsvCell(front),
          escapeCsvCell(back),
          escapeCsvCell(`drpdf ${tagSlug} quiz`),
        ].join(",")
      );
    }
  }

  if (rows.length === 0 && doc.summary?.markdown) {
    rows.push(
      [
        escapeCsvCell(`Ringkasan Utama: ${doc.title}`),
        escapeCsvCell(doc.summary.markdown.slice(0, 600)),
        escapeCsvCell(`drpdf ${tagSlug}`),
      ].join(",")
    );
  }

  // UTF-8 BOM ensures Anki imports Indonesian characters cleanly on Windows/macOS/Android
  const csvWithBom = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(blob, `${sanitizeFilename(doc.title)}-anki.csv`);
}

export async function exportAsFormattedPdf(doc: StoredDocument, locale: Locale = "id") {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;

  // Brand top banner
  pdf.setFillColor(5, 150, 105);
  pdf.rect(0, 0, pageWidth, 64, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text("dr.PdF Study Guide", margin, 32);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(209, 250, 229);
  pdf.text(
    `${doc.title.slice(0, 65)}  •  ${doc.pageCount} ${
      locale === "id" ? "Halaman" : "Pages"
    }`,
    margin,
    49
  );

  let y = 90;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      pdf.addPage();
      y = 50;
    }
  };

  if (doc.summary?.markdown) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(6, 95, 70);
    pdf.text(locale === "id" ? "1. Ringkasan Materi" : "1. Summary", margin, y);
    y += 18;

    const cleanSummary = doc.summary.markdown
      .replace(/^#+\s+/gm, "• ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    const wrapped = pdf.splitTextToSize(cleanSummary, maxWidth) as string[];
    for (const line of wrapped) {
      ensureSpace(15);
      pdf.text(line, margin, y);
      y += 14;
    }
    y += 16;
  }

  if (doc.flashcards && doc.flashcards.length > 0) {
    ensureSpace(60);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(6, 95, 70);
    pdf.text(
      locale === "id" ? "2. Kartu Hafalan (Active Recall)" : "2. Flashcards",
      margin,
      y
    );
    y += 10;

    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [
          "#",
          locale === "id" ? "Istilah" : "Term",
          locale === "id" ? "Definisi" : "Definition",
          "Hal.",
        ],
      ],
      body: doc.flashcards.map((fc, idx) => [
        String(idx + 1),
        fc.term,
        fc.definition,
        fc.pageReference ? String(fc.pageReference) : "-",
      ]),
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 9.5 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 130, fontStyle: "bold" },
        3: { cellWidth: 36 },
      },
    });

    const pdfWithTable = pdf as unknown as { lastAutoTable?: { finalY?: number } };
    y = (pdfWithTable.lastAutoTable?.finalY ?? y + 80) + 26;
  }

  if (doc.quiz && doc.quiz.questions.length > 0) {
    ensureSpace(60);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(6, 95, 70);
    pdf.text(
      locale === "id"
        ? "3. Soal Latihan Pilihan Ganda & Pembahasan"
        : "3. Practice Quiz & Explanations",
      margin,
      y
    );
    y += 20;

    doc.quiz.questions.forEach((q, idx) => {
      ensureSpace(90);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(15, 23, 42);
      const qLines = pdf.splitTextToSize(`${idx + 1}. ${q.question}`, maxWidth) as string[];
      pdf.text(qLines, margin, y);
      y += qLines.length * 14 + 4;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(51, 65, 85);
      (["A", "B", "C", "D", "E"] as const).forEach((opt) => {
        const optLines = pdf.splitTextToSize(
          `${opt}. ${q.options[opt]}`,
          maxWidth - 14
        ) as string[];
        ensureSpace(optLines.length * 13);
        pdf.text(optLines, margin + 12, y);
        y += optLines.length * 13;
      });

      y += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(5, 150, 105);
      const expLines = pdf.splitTextToSize(
        `${locale === "id" ? "Kunci" : "Answer"}: ${q.correctOption} — ${q.explanation}`,
        maxWidth - 14
      ) as string[];
      ensureSpace(expLines.length * 13 + 12);
      pdf.text(expLines, margin + 12, y);
      y += expLines.length * 13 + 14;
    });
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      `dr.PdF v2 • ${locale === "id" ? "Halaman" : "Page"} ${i} / ${totalPages}`,
      margin,
      pageHeight - 22
    );
  }

  pdf.save(`${sanitizeFilename(doc.title)}-drpdf.pdf`);
}
