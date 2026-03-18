import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  MessageCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  Clock,
} from "lucide-react";
import type { Conversation, Video, Document } from "@shared/schema";

interface AskResponse extends Conversation {
  sourceVideos?: Video[];
  sourceDocuments?: Document[];
}

export default function AskQuestion() {
  const [question, setQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState<AskResponse | null>(null);
  const { toast } = useToast();

  const { data: conversations, isLoading: convosLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const askMutation = useMutation({
    mutationFn: async (q: string): Promise<AskResponse> => {
      const res = await apiRequest("POST", "/api/ask", { question: q });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentAnswer(data);
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length >= 3) {
      askMutation.mutate(question.trim());
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="page-ask-question">
      <div className="text-center pt-4">
        <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary/10 mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
          Ask a Question
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get AI-powered answers from your knowledge base
        </p>
      </div>

      {/* Question Input */}
      <form onSubmit={handleSubmit} className="relative" data-testid="form-ask">
        <Input
          placeholder="Ask a question about any process or procedure..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="pr-12 h-12 text-sm"
          disabled={askMutation.isPending}
          data-testid="input-question"
        />
        <Button
          type="submit"
          size="sm"
          disabled={question.trim().length < 3 || askMutation.isPending}
          className="!absolute right-1.5 top-1.5 h-9 w-9 p-0 z-10"
          data-testid="button-submit-question"
        >
          {askMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Loading State */}
      {askMutation.isPending && (
        <Card data-testid="card-loading-answer">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Searching knowledge base and generating answer...</p>
          </CardContent>
        </Card>
      )}

      {/* Current Answer */}
      {currentAnswer && !askMutation.isPending && (
        <Card className="border-primary/20" data-testid="card-current-answer">
          <CardContent className="py-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {currentAnswer.question}
              </p>
            </div>
            <div className="pl-10">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {currentAnswer.answer.split("\n").map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed mb-2">
                    {p}
                  </p>
                ))}
              </div>

              {((currentAnswer.sourceVideos && currentAnswer.sourceVideos.length > 0) ||
                (currentAnswer.sourceDocuments && currentAnswer.sourceDocuments.length > 0)) && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {currentAnswer.sourceVideos?.map((v) => (
                      <a
                        key={`v-${v.id}`}
                        href={v.loomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-md transition-colors"
                        data-testid={`link-source-video-${v.id}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-muted-foreground">🎥</span>
                        {v.title}
                      </a>
                    ))}
                    {currentAnswer.sourceDocuments?.map((d) => (
                      d.sourceUrl ? (
                        <a
                          key={`d-${d.id}`}
                          href={d.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-md transition-colors"
                          data-testid={`link-source-doc-${d.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="text-muted-foreground">📄</span>
                          {d.title}
                        </a>
                      ) : (
                        <span
                          key={`d-${d.id}`}
                          className="inline-flex items-center gap-1.5 text-xs bg-muted/60 px-2.5 py-1.5 rounded-md"
                          data-testid={`text-source-doc-${d.id}`}
                        >
                          <span className="text-muted-foreground">📄</span>
                          {d.title}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Q&A History */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recent Questions</h2>
        {convosLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No questions asked yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.slice(0, 10).map((convo) => (
              <Card
                key={convo.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setCurrentAnswer(convo as AskResponse)}
                data-testid={`card-history-${convo.id}`}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{convo.question}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {convo.answer.slice(0, 120)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {convo.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(convo.askedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
