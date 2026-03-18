import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Terminal,
  Copy,
  Check,
  Send,
  Loader2,
  Webhook,
  MessageSquare,
  Zap,
  BotMessageSquare,
  Link2,
} from "lucide-react";

export default function SlackSetup() {
  const [copied, setCopied] = useState<string | null>(null);
  const [testQuestion, setTestQuestion] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const commandUrl = `${baseUrl}/api/slack/command`;
  const eventsUrl = `${baseUrl}/api/slack/events`;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const testMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/slack/command", {
        text: q,
        response_url: "",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data.text || JSON.stringify(data, null, 2));
    },
    onError: (err: any) => {
      setTestResult(`Error: ${err.message}`);
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="page-slack-setup">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
          Slack Integration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask questions via Slack and auto-import Loom videos when they're shared in channels
        </p>
      </div>

      {/* Setup Steps */}
      <div className="space-y-4">
        <Card data-testid="card-step-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                1
              </div>
              <CardTitle className="text-sm">Create a Slack App</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pl-13">
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid="link-slack-api"
                >
                  api.slack.com/apps
                </a>
              </li>
              <li>Click "Create New App" and choose "From scratch"</li>
              <li>Name it "DaveBot" and select your workspace</li>
            </ol>
          </CardContent>
        </Card>

        <Card data-testid="card-step-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                2
              </div>
              <CardTitle className="text-sm">Configure Slash Command</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Under "Slash Commands", create a new command <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/davebot</code> with this Request URL:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted p-2.5 rounded-md font-mono truncate block" data-testid="text-command-url">
                {commandUrl}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(commandUrl, "command")}
                data-testid="button-copy-command-url"
              >
                {copied === "command" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-step-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                3
              </div>
              <CardTitle className="text-sm">Configure Event Subscriptions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Enable Event Subscriptions and set the Request URL:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2.5 rounded-md font-mono truncate block" data-testid="text-events-url">
                  {eventsUrl}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(eventsUrl, "events")}
                  data-testid="button-copy-events-url"
                >
                  {copied === "events" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Subscribe to these bot events:</p>
              <ul className="space-y-1.5 pl-1">
                <li className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">app_mention</code>
                  <span className="text-xs">— Q&A when someone @mentions DaveBot</span>
                </li>
                <li className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">message.channels</code>
                  <span className="text-xs">— Auto-ingest Loom URLs from channel messages</span>
                </li>
                <li className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">link_shared</code>
                  <span className="text-xs">— Detect Loom links shared as unfurls</span>
                </li>
              </ul>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3" data-testid="card-auto-ingest-info">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Auto-Ingest</p>
                  <p>
                    When anyone shares a Loom link in a channel where DaveBot is added, the video is automatically imported into the knowledge base — no manual action needed. Duplicates are skipped.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-step-3b">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Link2 className="h-3.5 w-3.5" />
              </div>
              <CardTitle className="text-sm">Enable Auto-Ingest in Channels</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>In Slack, go to each channel where Dave shares Loom links</li>
              <li>Type <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/invite @DaveBot</code> to add the bot</li>
              <li>Any Loom URLs posted in that channel will be auto-imported</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: Only add DaveBot to channels where Loom content should be indexed.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-step-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                4
              </div>
              <CardTitle className="text-sm">Install to Workspace</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Go to "Install App" in the sidebar and click "Install to Workspace". Grant the requested permissions.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Section */}
      <Card data-testid="card-test-slack">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Test Integration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Simulate a Slack slash command query to verify everything works.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (testQuestion.trim()) {
                testMutation.mutate(testQuestion.trim());
              }
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="e.g. How do I submit a report?"
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              className="flex-1 text-sm"
              data-testid="input-test-question"
            />
            <Button
              type="submit"
              disabled={!testQuestion.trim() || testMutation.isPending}
              data-testid="button-test-slack"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {testResult && (
            <div className="mt-3 p-3 bg-muted/50 rounded-md" data-testid="text-test-result">
              <p className="text-xs font-mono whitespace-pre-wrap">{testResult}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
