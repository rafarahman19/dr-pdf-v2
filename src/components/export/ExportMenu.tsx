"use client";

import React, { useState } from "react";
import { Download, FileCode2, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StoredDocument } from "@/lib/storage/db";
import {
  exportAsAnkiCsv,
  exportAsFormattedPdf,
  exportAsMarkdown,
} from "@/lib/pdf/export-files";
import { useAppSettings } from "@/hooks/use-app-settings";

interface ExportMenuProps {
  doc: StoredDocument;
}

export function ExportMenu({ doc }: ExportMenuProps) {
  const { locale, t } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const hasContent =
    Boolean(doc.summary?.markdown) ||
    Boolean(doc.quiz?.questions.length) ||
    Boolean(doc.flashcards?.length);

  if (!hasContent) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Download className="h-4 w-4" />
          <span>{t.export.button}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.export.button}</DialogTitle>
          <DialogDescription className="truncate">{doc.title}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="secondary"
            className="justify-start h-12"
            onClick={() => {
              exportAsMarkdown(doc, locale);
              setOpen(false);
            }}
          >
            <FileCode2 className="h-5 w-5 text-primary shrink-0" />
            <span>{t.export.markdown}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="justify-start h-12"
            disabled={exportingPdf}
            onClick={async () => {
              setExportingPdf(true);
              try {
                await exportAsFormattedPdf(doc, locale);
                setOpen(false);
              } finally {
                setExportingPdf(false);
              }
            }}
          >
            {exportingPdf ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-primary shrink-0" />
            )}
            <span>{t.export.pdf}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="justify-start h-12"
            onClick={() => {
              exportAsAnkiCsv(doc);
              setOpen(false);
            }}
          >
            <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
            <span>{t.export.ankiCsv}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
