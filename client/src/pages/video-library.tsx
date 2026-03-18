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
  RefreshCw,
  FileText,
  Video,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Upload,
} from "lucide-react";
import type { Video as VideoType } from "@shared/schema";

function statusBadge(status: string) {
  switch (status) {
    case "ready":
      return (
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0">
          <AlertCircle className="h-3 w-3 mr-1" /> Error
        </Badge>
      );
    default:
      return (
        <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-0">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
  }
}

export default function VideoLibrary() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkResult, setBulkResult] = useState<{ total: number; added: number; failed: number } | null>(null);
  const [loomUrl, setLoomUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoType | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoType | null>(null);
  const { toast } = useToast();

  const { data: videos, isLoading } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
  });

  const addVideoMutation = useMutation({
    mutationFn: async (data: { url: string; title: string }) => {
      const res = await apiRequest("POST", "/api/videos", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setAddDialogOpen(false);
      setLoomUrl("");
      setVideoTitle("");
      toast({ title: "Video added", description: "Transcript fetching has started." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteDialogOpen(false);
      setVideoToDelete(null);
      toast({ title: "Video deleted" });
    },
  });

  const pasteTranscriptMutation = useMutation({
    mutationFn: async ({ id, transcript }: { id: number; transcript: string }) => {
      const res = await apiRequest("PUT", `/api/videos/${id}/transcript`, { transcript });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setTranscriptDialogOpen(false);
      setTranscriptText("");
      setSelectedVideo(null);
      toast({ title: "Transcript saved", description: "Video is now ready for Q&A." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const refetchMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/videos/${id}/refetch`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({ title: "Re-fetching transcript" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const res = await apiRequest("POST", "/api/videos/bulk", { urls });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setBulkResult({ total: data.total, added: data.added, failed: data.failed });
      toast({
        title: `${data.added} video${data.added !== 1 ? "s" : ""} imported`,
        description: data.failed > 0 ? `${data.failed} failed (invalid URLs)` : "Transcript fetching started for all.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const parsedUrlCount = bulkUrls
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;

  return (
    <div className="space-y-6" data-testid="page-video-library">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
            Video Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Loom videos and transcripts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setBulkDialogOpen(true);
              setBulkResult(null);
              setBulkUrls("");
            }}
            data-testid="button-bulk-import-videos"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button
            onClick={() => setAddDialogOpen(true)}
            data-testid="button-add-video"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Video
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !videos || videos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">
              No videos yet. Add a Loom video to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="group hover-elevate cursor-pointer"
              data-testid={`card-video-${video.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-28 h-16 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          setSelectedVideo(video);
                          setDetailsDialogOpen(true);
                        }}
                        data-testid={`text-video-title-${video.id}`}
                      >
                        {video.title}
                      </h3>
                      {statusBadge(video.status)}
                    </div>
                    {video.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate">{video.errorMessage}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{new Date(video.addedAt).toLocaleDateString()}</span>
                      {video.duration && (
                        <span>{Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid={`link-open-loom-${video.id}`}
                    >
                      <a
                        href={video.loomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>

                    {(video.status === "error" || video.status === "pending") && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVideo(video);
                            setTranscriptDialogOpen(true);
                          }}
                          data-testid={`button-paste-transcript-${video.id}`}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            refetchMutation.mutate(video.id);
                          }}
                          data-testid={`button-refetch-${video.id}`}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoToDelete(video);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-video-${video.id}`}
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

      {/* Bulk Import Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-bulk-import-videos">
          <DialogHeader>
            <DialogTitle>Bulk Import Videos</DialogTitle>
            <DialogDescription>
              Paste multiple Loom URLs below, one per line. Transcripts will be fetched automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder={"https://www.loom.com/share/abc123...\nhttps://www.loom.com/share/def456...\nhttps://www.loom.com/share/ghi789..."}
              className="min-h-[200px] text-sm font-mono"
              value={bulkUrls}
              onChange={(e) => {
                setBulkUrls(e.target.value);
                setBulkResult(null);
              }}
              disabled={bulkImportMutation.isPending}
              data-testid="textarea-bulk-urls"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{parsedUrlCount} URL{parsedUrlCount !== 1 ? "s" : ""} detected</span>
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
            <Button variant="secondary" onClick={() => setBulkDialogOpen(false)} data-testid="button-cancel-bulk">
              {bulkResult ? "Done" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                const urls = bulkUrls
                  .split("\n")
                  .map((l) => l.trim())
                  .filter((l) => l.length > 0);
                if (urls.length > 0) {
                  bulkImportMutation.mutate(urls);
                }
              }}
              disabled={parsedUrlCount === 0 || bulkImportMutation.isPending}
              data-testid="button-submit-bulk"
            >
              {bulkImportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Import {parsedUrlCount} Video{parsedUrlCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Video Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-video">
          <DialogHeader>
            <DialogTitle>Add Loom Video</DialogTitle>
            <DialogDescription>
              Paste a Loom share URL to add a video to your knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Loom URL</label>
              <Input
                placeholder="https://www.loom.com/share/..."
                value={loomUrl}
                onChange={(e) => setLoomUrl(e.target.value)}
                data-testid="input-loom-url"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title (optional)</label>
              <Input
                placeholder="e.g. Onboarding walkthrough"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                data-testid="input-video-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={() => addVideoMutation.mutate({ url: loomUrl, title: videoTitle })}
              disabled={!loomUrl || addVideoMutation.isPending}
              data-testid="button-submit-video"
            >
              {addVideoMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Add Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste Transcript Dialog */}
      <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-paste-transcript">
          <DialogHeader>
            <DialogTitle>Paste Transcript</DialogTitle>
            <DialogDescription>
              Paste the full transcript for "{selectedVideo?.title}".
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Paste the transcript text here..."
            className="min-h-[200px] text-sm"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            data-testid="textarea-transcript"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTranscriptDialogOpen(false)} data-testid="button-cancel-transcript">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedVideo) {
                  pasteTranscriptMutation.mutate({
                    id: selectedVideo.id,
                    transcript: transcriptText,
                  });
                }
              }}
              disabled={!transcriptText.trim() || pasteTranscriptMutation.isPending}
              data-testid="button-submit-transcript"
            >
              {pasteTranscriptMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Transcript
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-video-details">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
            <DialogDescription>
              <a
                href={selectedVideo?.loomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open in Loom
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {selectedVideo && statusBadge(selectedVideo.status)}
            </div>
            {selectedVideo?.transcript && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Transcript:</span>
                <div className="max-h-60 overflow-y-auto bg-muted/50 rounded-md p-3 text-sm">
                  {selectedVideo.transcript.slice(0, 2000)}
                  {selectedVideo.transcript.length > 2000 && "..."}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{videoToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => videoToDelete && deleteVideoMutation.mutate(videoToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
