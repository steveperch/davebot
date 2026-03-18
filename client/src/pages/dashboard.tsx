import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, FileText, MessageCircle, CheckCircle, Clock } from "lucide-react";
import type { Conversation } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalVideos: number;
    readyVideos: number;
    totalDocuments: number;
    totalQuestions: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: conversations, isLoading: convosLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  return (
    <div className="space-y-8" data-testid="page-dashboard">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your knowledge base
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total-videos">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Loom Videos</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold" data-testid="text-total-videos">
                    {stats?.totalVideos ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-ready-videos">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Videos Ready</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold" data-testid="text-ready-videos">
                    {stats?.readyVideos ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-total-documents">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold" data-testid="text-total-documents">
                    {stats?.totalDocuments ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-total-questions">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <MessageCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Questions Asked</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold" data-testid="text-total-questions">
                    {stats?.totalQuestions ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Questions */}
      <div>
        <h2 className="text-base font-semibold mb-4">Recent Questions</h2>
        {convosLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No questions asked yet. Go to the Ask page to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {conversations.slice(0, 5).map((convo) => (
              <Card key={convo.id} data-testid={`card-conversation-${convo.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" data-testid={`text-question-${convo.id}`}>
                        {convo.question}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {convo.answer}
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
