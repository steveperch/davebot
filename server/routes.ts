import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/i);
  return match ? match[1] : null;
}

function chunkText(text: string, chunkSize = 500): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  const overlap = 50;

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }
  return chunks;
}

async function processTranscriptChunks(videoId: number, transcript: string) {
  storage.deleteChunksByVideoId(videoId);
  const textChunks = chunkText(transcript);
  for (let i = 0; i < textChunks.length; i++) {
    storage.addChunk({
      videoId,
      documentId: null,
      content: textChunks[i],
      startTime: null,
      chunkIndex: i,
      sourceType: "video",
    });
  }
}

async function processDocumentChunks(documentId: number, content: string) {
  storage.deleteChunksByDocumentId(documentId);
  const textChunks = chunkText(content);
  for (let i = 0; i < textChunks.length; i++) {
    storage.addChunk({
      videoId: null,
      documentId,
      content: textChunks[i],
      startTime: null,
      chunkIndex: i,
      sourceType: "document",
    });
  }
}

async function fetchTranscript(videoId: number, loomId: string) {
  try {
    storage.updateVideoStatus(videoId, "processing");

    const resp = await fetch(`https://www.loom.com/share/${loomId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!resp.ok) {
      storage.updateVideoStatus(videoId, "error", undefined, `Failed to fetch Loom page: ${resp.status}`);
      return;
    }

    const html = await resp.text();

    let transcript: string | null = null;
    let title: string | null = null;
    let thumbnailUrl: string | null = null;

    // Extract thumbnail
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
    if (ogImageMatch) {
      thumbnailUrl = ogImageMatch[1];
    }

    // Extract title
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/);
    if (titleMatch) title = titleMatch[1];
    if (!title) {
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleTagMatch) title = titleTagMatch[1].replace(/ \| Loom$/, "").trim();
    }

    // Strategy 1: Extract signed transcript URL from Apollo state and fetch transcript JSON
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
    if (apolloMatch) {
      try {
        const apollo = JSON.parse(apolloMatch[1]);
        // Look for the signed source_url for transcript in VideoTranscriptDetails
        for (const key of Object.keys(apollo)) {
          const val = apollo[key];
          if (val?.source_url && typeof val.source_url === "string" && val.source_url.includes("transcription")) {
            try {
              const transcriptResp = await fetch(val.source_url, {
                headers: { "User-Agent": "Mozilla/5.0" },
              });
              if (transcriptResp.ok) {
                const transcriptData = await transcriptResp.json();
                // Loom transcript JSON has { phrases: [{ value: "text" }, ...] }
                if (transcriptData?.phrases && Array.isArray(transcriptData.phrases)) {
                  transcript = transcriptData.phrases
                    .map((p: any) => p.value || "")
                    .filter((t: string) => t.trim())
                    .join(" ");
                }
              }
            } catch {
              // Failed to fetch transcript JSON, will try fallbacks
            }
            break;
          }
        }

        // Fallback: look for transcript_text directly in Apollo state
        if (!transcript) {
          for (const key of Object.keys(apollo)) {
            if (apollo[key]?.transcript_text) {
              transcript = apollo[key].transcript_text;
              break;
            }
          }
        }
      } catch {
        // Apollo parse failed
      }
    }

    // Strategy 2: Try __NEXT_DATA__ (older Loom pages)
    if (!transcript) {
      const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const data = JSON.parse(nextDataMatch[1]);
          const props = data?.props?.pageProps;
          if (props?.transcript) {
            transcript = props.transcript;
          }
          if (!title && (props?.name || props?.title)) {
            title = props.name || props.title;
          }
        } catch {
          // JSON parse failed
        }
      }
    }

    // Strategy 3: Try generic JSON patterns in the HTML
    if (!transcript) {
      const transcriptPatterns = [
        /"transcript(?:_text)?"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"transcription"\s*:\s*\{[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/,
      ];
      for (const pat of transcriptPatterns) {
        const m = html.match(pat);
        if (m && m[1] && m[1].length > 50) {
          transcript = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
          break;
        }
      }
    }

    // Update video metadata
    const video = storage.getVideo(videoId);
    if (video && title && video.title === `Loom Video ${loomId.slice(0, 8)}`) {
      const updated = storage.updateVideoStatus(videoId, video.status);
      if (updated) {
        (updated as any).title = title;
      }
    }
    if (video && thumbnailUrl) {
      (video as any).thumbnailUrl = thumbnailUrl;
    }

    if (transcript && transcript.length > 50) {
      await processTranscriptChunks(videoId, transcript);
      storage.updateVideoStatus(videoId, "ready", transcript);
    } else {
      storage.updateVideoStatus(
        videoId,
        "error",
        undefined,
        "Could not auto-fetch transcript. Please paste the transcript manually."
      );
    }
  } catch (err: any) {
    storage.updateVideoStatus(videoId, "error", undefined, err.message || "Failed to fetch transcript");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ===== Video Management =====

  app.get("/api/videos", async (_req, res) => {
    const videos = storage.getAllVideos();
    res.json(videos);
  });

  app.post("/api/videos", async (req, res) => {
    const { url, title } = req.body;
    if (!url) {
      return res.status(400).json({ message: "Loom URL is required" });
    }

    const loomId = extractLoomId(url);
    if (!loomId) {
      return res.status(400).json({ message: "Invalid Loom URL. Must contain /share/ or /embed/ path." });
    }

    const video = storage.addVideo({
      title: title || `Loom Video ${loomId.slice(0, 8)}`,
      loomUrl: url,
      loomId,
      transcript: null,
      duration: null,
      thumbnailUrl: null,
      status: "pending",
      errorMessage: null,
      addedAt: new Date().toISOString(),
    });

    fetchTranscript(video.id, loomId).catch(() => {});
    res.status(201).json(video);
  });

  // Bulk add videos
  app.post("/api/videos/bulk", async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ message: "urls array is required" });
    }

    const results: { url: string; success: boolean; video?: any; error?: string }[] = [];

    for (const rawUrl of urls) {
      const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
      if (!url) continue;

      const loomId = extractLoomId(url);
      if (!loomId) {
        results.push({ url, success: false, error: "Invalid Loom URL" });
        continue;
      }

      // Dedup check
      const existing = storage.getVideoByLoomId(loomId);
      if (existing) {
        results.push({ url, success: false, error: "Already imported" });
        continue;
      }

      const video = storage.addVideo({
        title: `Loom Video ${loomId.slice(0, 8)}`,
        loomUrl: url,
        loomId,
        transcript: null,
        duration: null,
        thumbnailUrl: null,
        status: "pending",
        errorMessage: null,
        addedAt: new Date().toISOString(),
      });

      fetchTranscript(video.id, loomId).catch(() => {});
      results.push({ url, success: true, video });
    }

    res.status(201).json({
      total: results.length,
      added: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  });

  app.delete("/api/videos/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const video = storage.getVideo(id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    storage.deleteVideo(id);
    res.json({ success: true });
  });

  app.post("/api/videos/:id/refetch", async (req, res) => {
    const id = parseInt(req.params.id);
    const video = storage.getVideo(id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    storage.updateVideoStatus(id, "pending", undefined, undefined);
    fetchTranscript(id, video.loomId).catch(() => {});
    res.json({ success: true, message: "Re-fetching transcript" });
  });

  // Manual transcript paste
  app.put("/api/videos/:id/transcript", async (req, res) => {
    const id = parseInt(req.params.id);
    const video = storage.getVideo(id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return res.status(400).json({ message: "Transcript must be at least 10 characters" });
    }

    await processTranscriptChunks(id, transcript.trim());
    storage.updateVideoStatus(id, "ready", transcript.trim(), "");
    const updated = storage.getVideo(id);
    res.json(updated);
  });

  // ===== Document Management =====

  app.get("/api/documents", async (_req, res) => {
    const documents = storage.getAllDocuments();
    res.json(documents);
  });

  app.post("/api/documents", async (req, res) => {
    const { title, content, docType, sourceUrl } = req.body;
    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!content || typeof content !== "string" || content.trim().length < 10) {
      return res.status(400).json({ message: "Content must be at least 10 characters" });
    }

    const doc = storage.addDocument({
      title: title.trim(),
      content: content.trim(),
      docType: docType || "text",
      sourceUrl: sourceUrl || null,
      status: "ready",
      addedAt: new Date().toISOString(),
    });

    // Chunk the document content
    await processDocumentChunks(doc.id, content.trim());

    res.status(201).json(doc);
  });

  // Bulk add documents
  app.post("/api/documents/bulk", async (req, res) => {
    const { documents: docs } = req.body;
    if (!docs || !Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({ message: "documents array is required" });
    }

    const results: { title: string; success: boolean; document?: any; error?: string }[] = [];

    for (const entry of docs) {
      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      const content = typeof entry.content === "string" ? entry.content.trim() : "";

      if (!title) {
        results.push({ title: "(untitled)", success: false, error: "Title is required" });
        continue;
      }
      if (content.length < 10) {
        results.push({ title, success: false, error: "Content must be at least 10 characters" });
        continue;
      }

      const doc = storage.addDocument({
        title,
        content,
        docType: entry.sourceUrl ? "url" : "text",
        sourceUrl: entry.sourceUrl || null,
        status: "ready",
        addedAt: new Date().toISOString(),
      });

      await processDocumentChunks(doc.id, content);
      results.push({ title, success: true, document: doc });
    }

    res.status(201).json({
      total: results.length,
      added: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  });

  app.put("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const doc = storage.getDocument(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    const { title, content } = req.body;
    if (title) (doc as any).title = title.trim();
    if (content && content.trim().length >= 10) {
      (doc as any).content = content.trim();
      await processDocumentChunks(id, content.trim());
    }
    res.json(doc);
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const doc = storage.getDocument(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }
    storage.deleteDocument(id);
    res.json({ success: true });
  });

  // ===== Q&A / Chat =====

  app.post("/api/ask", async (req, res) => {
    const { question } = req.body;
    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return res.status(400).json({ message: "Question must be at least 3 characters" });
    }

    const relevantChunks = storage.searchChunks(question);

    if (relevantChunks.length === 0) {
      const convo = storage.addConversation({
        question: question.trim(),
        answer: "I couldn't find any relevant information in the knowledge base. Make sure videos or documents have been added.",
        sourceVideoIds: JSON.stringify([]),
        sourceDocumentIds: JSON.stringify([]),
        askedAt: new Date().toISOString(),
        source: "web",
      });
      return res.json(convo);
    }

    // Build context from both videos and documents
    const contextParts = relevantChunks.map((c) => {
      if (c.video) {
        return `[Video: "${c.video.title}" (${c.video.loomUrl})]\n${c.content}`;
      } else if (c.document) {
        const urlPart = c.document.sourceUrl ? ` (${c.document.sourceUrl})` : "";
        return `[Document: "${c.document.title}"${urlPart}]\n${c.content}`;
      }
      return c.content;
    });
    const context = contextParts.join("\n\n---\n\n");

    const uniqueVideoIds = [...new Set(relevantChunks.filter((c) => c.video).map((c) => c.video!.id))];
    const uniqueDocIds = [...new Set(relevantChunks.filter((c) => c.document).map((c) => c.document!.id))];

    try {
      const message = await anthropic.messages.create({
        model: "claude_sonnet_4_6",
        max_tokens: 1024,
        system:
          "You are DaveBot, a helpful assistant that answers questions based on a company's knowledge base which includes Loom video transcripts and supporting documents. Answer the question using ONLY the provided context. Always reference which video(s) or document(s) contain the relevant information. If you can't find the answer in the provided context, say so honestly. Format your response in clear, readable paragraphs.",
        messages: [
          {
            role: "user",
            content: `Context from knowledge base:\n\n${context}\n\nQuestion: ${question.trim()}`,
          },
        ],
      });

      const answerText =
        message.content[0].type === "text" ? message.content[0].text : "Unable to generate answer.";

      const sourceVideos = uniqueVideoIds.map((vid) => storage.getVideo(vid)).filter(Boolean);
      const sourceDocs = uniqueDocIds.map((did) => storage.getDocument(did)).filter(Boolean);

      const convo = storage.addConversation({
        question: question.trim(),
        answer: answerText,
        sourceVideoIds: JSON.stringify(uniqueVideoIds),
        sourceDocumentIds: JSON.stringify(uniqueDocIds),
        askedAt: new Date().toISOString(),
        source: "web",
      });

      res.json({
        ...convo,
        sourceVideos,
        sourceDocuments: sourceDocs,
      });
    } catch (err: any) {
      console.error("Claude API error:", err);
      const convo = storage.addConversation({
        question: question.trim(),
        answer: "Sorry, there was an error generating the answer. Please try again.",
        sourceVideoIds: JSON.stringify(uniqueVideoIds),
        sourceDocumentIds: JSON.stringify(uniqueDocIds),
        askedAt: new Date().toISOString(),
        source: "web",
      });
      res.json({ ...convo, sourceVideos: [], sourceDocuments: [] });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const conversations = storage.getRecentConversations(limit);
    res.json(conversations);
  });

  app.get("/api/stats", async (_req, res) => {
    const videos = storage.getAllVideos();
    const documents = storage.getAllDocuments();
    const conversations = storage.getRecentConversations(1000);
    res.json({
      totalVideos: videos.length,
      readyVideos: videos.filter((v) => v.status === "ready").length,
      totalDocuments: documents.length,
      totalQuestions: conversations.length,
    });
  });

  // ===== Slack Integration =====

  app.post("/api/slack/command", async (req, res) => {
    const { text: questionText, response_url } = req.body;
    if (!questionText) {
      return res.json({
        response_type: "ephemeral",
        text: "Please provide a question. Usage: /davebot What is the onboarding process?",
      });
    }

    // Respond immediately, then process async
    res.json({
      response_type: "in_channel",
      text: `Searching knowledge base for: "${questionText}"...`,
    });

    try {
      const relevantChunks = storage.searchChunks(questionText);
      let answerText = "No relevant information found in the knowledge base.";
      let sourceVideos: any[] = [];
      let sourceDocs: any[] = [];

      if (relevantChunks.length > 0) {
        const contextParts = relevantChunks.map((c) => {
          if (c.video) return `[Video: "${c.video.title}"]\n${c.content}`;
          if (c.document) return `[Document: "${c.document.title}"]\n${c.content}`;
          return c.content;
        });
        const context = contextParts.join("\n\n---\n\n");
        const uniqueVideoIds = [...new Set(relevantChunks.filter((c) => c.video).map((c) => c.video!.id))];
        const uniqueDocIds = [...new Set(relevantChunks.filter((c) => c.document).map((c) => c.document!.id))];

        const message = await anthropic.messages.create({
          model: "claude_sonnet_4_6",
          max_tokens: 1024,
          system:
            "You are DaveBot, a helpful assistant that answers questions based on Loom video transcripts and supporting documents. Answer concisely using ONLY the provided context. Reference which videos or documents contain the information.",
          messages: [
            { role: "user", content: `Context:\n\n${context}\n\nQuestion: ${questionText}` },
          ],
        });

        answerText = message.content[0].type === "text" ? message.content[0].text : answerText;
        sourceVideos = uniqueVideoIds.map((id) => storage.getVideo(id)).filter(Boolean);
        sourceDocs = uniqueDocIds.map((id) => storage.getDocument(id)).filter(Boolean);

        storage.addConversation({
          question: questionText,
          answer: answerText,
          sourceVideoIds: JSON.stringify(uniqueVideoIds),
          sourceDocumentIds: JSON.stringify(uniqueDocIds),
          askedAt: new Date().toISOString(),
          source: "slack",
        });
      }

      // Post to response_url if available
      if (response_url) {
        const blocks: any[] = [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Q: ${questionText}*\n\n${answerText}` },
          },
        ];
        const sourceLinks: string[] = [];
        if (sourceVideos.length > 0) {
          sourceLinks.push(...sourceVideos.map((v: any) => `• <${v.loomUrl}|🎥 ${v.title}>`));
        }
        if (sourceDocs.length > 0) {
          sourceDocs.forEach((d: any) => {
            if (d.sourceUrl) {
              sourceLinks.push(`• <${d.sourceUrl}|📄 ${d.title}>`);
            } else {
              sourceLinks.push(`• 📄 ${d.title}`);
            }
          });
        }
        if (sourceLinks.length > 0) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Sources:*\n${sourceLinks.join("\n")}`,
            },
          });
        }
        await fetch(response_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response_type: "in_channel", blocks }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Slack command error:", err);
    }
  });

  // Helper: extract all Loom URLs from text
  function extractLoomUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/[a-f0-9]+/gi);
    return matches ? [...new Set(matches)] : [];
  }

  // Helper: auto-import a Loom URL (with dedup)
  async function autoImportLoom(url: string): Promise<{ added: boolean; loomId: string; reason?: string }> {
    const loomId = extractLoomId(url);
    if (!loomId) return { added: false, loomId: "", reason: "invalid_url" };

    // Dedup check
    const existing = storage.getVideoByLoomId(loomId);
    if (existing) return { added: false, loomId, reason: "duplicate" };

    const video = storage.addVideo({
      title: `Loom Video ${loomId.slice(0, 8)}`,
      loomUrl: url,
      loomId,
      transcript: null,
      duration: null,
      thumbnailUrl: null,
      status: "pending",
      errorMessage: null,
      addedAt: new Date().toISOString(),
    });

    fetchTranscript(video.id, loomId).catch(() => {});
    return { added: true, loomId };
  }

  app.post("/api/slack/events", async (req, res) => {
    // Handle URL verification challenge
    if (req.body.type === "url_verification") {
      return res.json({ challenge: req.body.challenge });
    }

    // Respond immediately to Slack (3-second timeout)
    res.status(200).send("ok");

    // Handle event callbacks asynchronously
    if (req.body.type === "event_callback") {
      const event = req.body.event;
      if (!event) return;

      // --- Auto-ingest: detect Loom URLs in messages ---
      if (event.type === "message" && !event.subtype && !event.bot_id) {
        const text = event.text || "";
        const loomUrls = extractLoomUrls(text);

        if (loomUrls.length > 0) {
          // Auto-import each Loom URL found in the message
          for (const url of loomUrls) {
            try {
              await autoImportLoom(url);
            } catch {
              // Silent fail — don't break on individual imports
            }
          }
          return; // Don't also try Q&A for messages that contain Loom URLs
        }
      }

      // --- Auto-ingest: handle link_shared events ---
      if (event.type === "link_shared" && event.links) {
        for (const link of event.links) {
          const url = link.url || "";
          if (/loom\.com\/(?:share|embed)\//i.test(url)) {
            try {
              await autoImportLoom(url);
            } catch {
              // Silent fail
            }
          }
        }
        return;
      }

      // --- Q&A: respond to @mentions ---
      if (event.type === "app_mention") {
        const question = (event.text || "").replace(/<@[^>]+>/g, "").trim();
        if (question) {
          const relevantChunks = storage.searchChunks(question);
          if (relevantChunks.length > 0) {
            const contextParts = relevantChunks.map((c) => {
              if (c.video) return `[Video: "${c.video.title}"]\n${c.content}`;
              if (c.document) return `[Document: "${c.document.title}"]\n${c.content}`;
              return c.content;
            });
            const context = contextParts.join("\n\n---\n\n");
            const uniqueVideoIds = [...new Set(relevantChunks.filter((c) => c.video).map((c) => c.video!.id))];
            const uniqueDocIds = [...new Set(relevantChunks.filter((c) => c.document).map((c) => c.document!.id))];

            try {
              const message = await anthropic.messages.create({
                model: "claude_sonnet_4_6",
                max_tokens: 1024,
                system: "You are DaveBot, a helpful assistant that answers questions based on Loom video transcripts and supporting documents. Answer concisely.",
                messages: [{ role: "user", content: `Context:\n\n${context}\n\nQuestion: ${question}` }],
              });

              storage.addConversation({
                question,
                answer: message.content[0].type === "text" ? message.content[0].text : "",
                sourceVideoIds: JSON.stringify(uniqueVideoIds),
                sourceDocumentIds: JSON.stringify(uniqueDocIds),
                askedAt: new Date().toISOString(),
                source: "slack",
              });
            } catch {
              // Silent fail for event processing
            }
          }
        }
      }
    }
  });

  return httpServer;
}
