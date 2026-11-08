"use client";

import React, { useState } from "react";
import {
  BookMarked,
  Check,
  FileText,
  FolderOpen,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StoredDocument } from "@/lib/storage/db";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatNumber, formatRelativeDate } from "@/lib/utils";

interface LibraryPanelProps {
  documents: StoredDocument[];
  activeDocId: string | null;
  onOpenDocument: (doc: StoredDocument) => void;
  onRenameDocument: (id: string, newTitle: string) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  onGoUpload: () => void;
}

export function LibraryPanel({
  documents,
  activeDocId,
  onOpenDocument,
  onRenameDocument,
  onDeleteDocument,
  onGoUpload,
}: LibraryPanelProps) {
  const { locale, t } = useAppSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary shrink-0" />
            {t.library.title}
          </CardTitle>
          <CardDescription>{t.library.subtitle}</CardDescription>
        </CardHeader>
      </Card>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-5 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FolderOpen className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold">{t.library.emptyTitle}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t.library.emptyDesc}
              </p>
            </div>
            <Button type="button" onClick={onGoUpload}>
              {t.upload.pickButton}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {documents.map((doc) => {
            const isActive = doc.id === activeDocId;
            const isEditing = editingId === doc.id;
            const isConfirmingDelete = confirmDeleteId === doc.id;

            return (
              <Card
                key={doc.id}
                className={
                  isActive ? "border-primary ring-1 ring-primary/30" : ""
                }
              >
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void onRenameDocument(doc.id, draftTitle).then(() =>
                                setEditingId(null)
                              );
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              value={draftTitle}
                              onChange={(e) => setDraftTitle(e.target.value)}
                              autoFocus
                              aria-label={t.library.renamePrompt}
                              className="min-h-10 w-full rounded-lg border border-primary bg-background px-2.5 text-sm font-bold focus:outline-none"
                            />
                            <Button
                              type="submit"
                              size="icon"
                              aria-label="Save new name"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Cancel rename"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </form>
                        ) : (
                          <>
                            <h3 className="text-base font-bold text-foreground truncate">
                              {doc.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatNumber(doc.pageCount, locale)}{" "}
                              {t.upload.pagesLabel} • ~
                              {formatNumber(doc.estimatedTokens, locale)} token •{" "}
                              {formatRelativeDate(doc.updatedAt, locale)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Saved Artifact Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {doc.summary?.markdown && (
                      <Badge variant="success">
                        ✓ {t.library.savedBadges.summary}
                      </Badge>
                    )}
                    {doc.quiz && doc.quiz.questions.length > 0 && (
                      <Badge variant="success">
                        ✓ {t.library.savedBadges.quiz} ({doc.quiz.questions.length})
                      </Badge>
                    )}
                    {doc.flashcards && doc.flashcards.length > 0 && (
                      <Badge variant="success">
                        ✓ {t.library.savedBadges.flashcards} ({doc.flashcards.length})
                      </Badge>
                    )}
                    {doc.chatMessages && doc.chatMessages.length > 0 && (
                      <Badge variant="secondary">
                        {t.library.savedBadges.chat} ({doc.chatMessages.length})
                      </Badge>
                    )}
                  </div>

                  {/* Action Row */}
                  {isConfirmingDelete ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/35 bg-red-500/10 p-3">
                      <span className="text-xs font-semibold text-foreground">
                        {t.library.deleteConfirm}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            void onDeleteDocument(doc.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          {t.library.deleteBtn}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onOpenDocument(doc)}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {t.library.openBtn}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(doc.id);
                          setDraftTitle(doc.title);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {t.library.renameBtn}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDeleteId(doc.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t.library.deleteBtn}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
