import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  Link2,
  FileType,
  Loader2,
  Eye,
  Upload,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { Document } from "@shared/schema";

function docTypeBadge(docType: string) {
  switch (docType) {
    case "url":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
          <Link2 className="h-3 w-3 mr-1" /> URL
        </Badge>
      );
    case "pdf":
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0">
          <FileType className="h-3 w-3 mr-1" /> PDF
        </Badge>
      );
    default:
      return (
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">
          <FileText className="h-3 w-3 mr-1" /> Text
        </Badge>
      );
  }
}

function parseBulkDocs(raw: string): { title: string; content: string }[] {
  // Split on --- lines (separator between documents)
  const blocks = raw.split(/^---+$/m).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const title = lines[0].trim();
    const content = lines.slice(1).join("\n").trim();
    return { title, content };
  });
}

export default function DocumentLibrary() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ total: number; added: number; failed: number } | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docSourceUrl, setDocSourceUrl] = useState("");
  const [docType, setDocType] = useState<"text" | "url">("text");
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const addDocMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; docType: string; sourceUrl: string }) => {
      const res = await apiRequest("POST", "/api/documents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setAddDialogOpen(false);
      setDocTitle("");
      setDocContent("");
      setDocSourceUrl("");
      setDocType("text");
      toast({ title: "Document added", description: "Content has been indexed for Q&A." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteDialogOpen(false);
      setDocToDelete(null);
      toast({ title: "Document deleted" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (documents: { title: string; content: string }[]) => {
      const res = await apiRequest("POST", "/api/documents/bulk", { documents });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setBulkResult({ total: data.total, added: data.added, failed: data.failed });
      toast({
        title: `${data.added} document${data.added !== 1 ? "s" : ""} imported`,
        description: data.failed > 0 ? `${data.failed} failed (invalid content)` : "All documents indexed for Q&A.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const parsedDocs = parseBulkDocs(bulkText);
  const validDocCount = parsedDocs.filter((d) => d.title && d.content.length >= 10).length;

  return (
    <div className="space-y-6" data-testid="page-document-library">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
            Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add SOPs, guides, FAQs, and other supporting docs to the knowledge base
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setBulkDialogOpen(true);
              setBulkResult(null);
              setBulkText("");
            }}
            data-testid="button-bulk-import-docs"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button
            onClick={() => setAddDialogOpen(true)}
            data-testid="button-add-document"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !documents || documents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">
              No documents yet. Add SOPs, guides, or any supporting text to enrich the knowledge base.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className="group hover-elevate"
              data-testid={`card-document-${doc.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-muted-foreground/60" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          setViewDoc(doc);
                          setViewDialogOpen(true);
                        }}
                        data-testid={`text-doc-title-${doc.id}`}
                      >
                        {doc.title}
                      </h3>
                      {docTypeBadge(doc.docType)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {doc.content.slice(0, 120)}...
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{new Date(doc.addedAt).toLocaleDateString()}</span>
                      <span>{Math.ceil(doc.content.split(/\s+/).length / 1)} words</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setViewDoc(doc);
                        setViewDialogOpen(true);
                      }}
                      data-testid={`button-view-doc-${doc.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {doc.sourceUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        data-testid={`link-open-doc-${doc.id}`}
                      >
                        <a
                          href={doc.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDocToDelete(doc);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Import Documents Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-bulk-import-docs">
          <DialogHeader>
            <DialogTitle>Bulk Import Documents</DialogTitle>
            <DialogDescription>
              Paste multiple documents below. First line of each block is the title, followed by the content. Separate documents with a line of dashes (---).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder={"Employee Onboarding Guide\nStep 1: Complete HR paperwork...\nStep 2: Set up your workstation...\n---\nExpense Report Policy\nAll expenses must be submitted within 30 days...\nReceipts required for purchases over $25...\n---\nVacation Request Process\nSubmit requests at least 2 weeks in advance..."}
              className="min-h-[240px] text-sm"
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setBulkResult(null);
              }}
              disabled={bulkImportMutation.isPending}
              data-testid="textarea-bulk-docs"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validDocCount} document{validDocCount !== 1 ? "s" : ""} detected</span>
              {bulkResult && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {bulkResult.added} added
                  {bulkResult.failed > 0 && (
                    <span className="text-red-500 ml-2">
                      <AlertCircle className="h-3 w-3 inline mr-0.5" />
                      {bulkResult.failed} failed
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBulkDialogOpen(false)} data-testid="button-cancel-bulk-docs">
              {bulkResult ? "Done" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                if (parsedDocs.length > 0) {
                  bulkImportMutation.mutate(parsedDocs);
                }
              }}
              disabled={validDocCount === 0 || bulkImportMutation.isPending}
              data-testid="button-submit-bulk-docs"
            >
              {bulkImportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Import {validDocCount} Document{validDocCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-add-document">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Add a supporting document, SOP, FAQ, or guide to the knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                placeholder="e.g. Employee Onboarding SOP"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                data-testid="input-doc-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Source URL (optional)</label>
              <Input
                placeholder="https://docs.google.com/... or any link"
                value={docSourceUrl}
                onChange={(e) => setDocSourceUrl(e.target.value)}
                data-testid="input-doc-source-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Link to the original doc (Google Doc, Notion page, etc.) — employees will see this as a source
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content</label>
              <Textarea
                placeholder="Paste the full document content here..."
                className="min-h-[200px] text-sm"
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                data-testid="textarea-doc-content"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste the text content of the document. This will be indexed and searchable via Q&A.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add-doc">
              Cancel
            </Button>
            <Button
              onClick={() =>
                addDocMutation.mutate({
                  title: docTitle,
                  content: docContent,
                  docType: docSourceUrl ? "url" : "text",
                  sourceUrl: docSourceUrl,
                })
              }
              disabled={!docTitle.trim() || docContent.trim().length < 10 || addDocMutation.isPending}
              data-testid="button-submit-document"
            >
              {addDocMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-view-document">
          <DialogHeader>
            <DialogTitle>{viewDoc?.title}</DialogTitle>
            {viewDoc?.sourceUrl && (
              <DialogDescription>
                <a
                  href={viewDoc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open original document
                </a>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              {viewDoc && docTypeBadge(viewDoc.docType)}
            </div>
            {viewDoc?.content && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Content:</span>
                <div className="max-h-60 overflow-y-auto bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
                  {viewDoc.content.slice(0, 3000)}
                  {viewDoc.content.length > 3000 && "..."}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-doc-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{docToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-doc">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => docToDelete && deleteDocMutation.mutate(docToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-doc"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
