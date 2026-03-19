import {
  type Video, type InsertVideo,
  type Chunk, type InsertChunk,
  type Document, type InsertDocument,
  type Conversation, type InsertConversation,
} from "@shared/schema";
import Database from "better-sqlite3";
import { join } from "path";

export interface IStorage {
  addVideo(video: InsertVideo): Video;
  getVideo(id: number): Video | undefined;
  getVideoByLoomId(loomId: string): Video | undefined;
  getAllVideos(): Video[];
  updateVideoStatus(id: number, status: string, transcript?: string, errorMessage?: string, visualContext?: string): Video | undefined;
  updateVideoMetadata(id: number, title?: string, thumbnailUrl?: string): Video | undefined;
  deleteVideo(id: number): void;
  addChunk(chunk: InsertChunk): Chunk;
  getChunksByVideoId(videoId: number): Chunk[];
  getChunksByDocumentId(documentId: number): Chunk[];
  getAllChunks(): Chunk[];
  deleteChunksByVideoId(videoId: number): void;
  deleteChunksByDocumentId(documentId: number): void;
  searchChunks(query: string): Array<Chunk & { video?: Video; document?: Document }>;
  addDocument(doc: InsertDocument): Document;
  getDocument(id: number): Document | undefined;
  getAllDocuments(): Document[];
  deleteDocument(id: number): void;
  addConversation(convo: InsertConversation): Conversation;
  getRecentConversations(limit: number): Conversation[];
}

// Determine database path — use RAILWAY_VOLUME_MOUNT_PATH if available, else local data dir
function getDbPath(): string {
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR;
  if (volumePath) {
    return join(volumePath, "davebot.db");
  }
  // Local dev: store in project root
  return join(process.cwd(), "data", "davebot.db");
}

export class DatabaseStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    const dbPath = getDbPath();

    // Ensure directory exists
    const { mkdirSync } = require("fs");
    const { dirname } = require("path");
    try {
      mkdirSync(dirname(dbPath), { recursive: true });
    } catch {}

    console.log(`[DB] Opening SQLite database at: ${dbPath}`);
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent read/write performance
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");

    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        loom_url TEXT NOT NULL,
        loom_id TEXT NOT NULL,
        transcript TEXT,
        visual_context TEXT,
        duration INTEGER,
        thumbnail_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        added_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER,
        document_id INTEGER,
        content TEXT NOT NULL,
        start_time INTEGER,
        chunk_index INTEGER NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'video'
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        doc_type TEXT NOT NULL DEFAULT 'text',
        source_url TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        added_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        source_video_ids TEXT NOT NULL,
        source_document_ids TEXT,
        asked_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'web'
      );

      CREATE INDEX IF NOT EXISTS idx_videos_loom_id ON videos(loom_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_video_id ON chunks(video_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
    `);
  }

  // Map DB row (snake_case) to app type (camelCase)
  private toVideo(row: any): Video {
    return {
      id: row.id,
      title: row.title,
      loomUrl: row.loom_url,
      loomId: row.loom_id,
      transcript: row.transcript,
      visualContext: row.visual_context,
      duration: row.duration,
      thumbnailUrl: row.thumbnail_url,
      status: row.status,
      errorMessage: row.error_message,
      addedAt: row.added_at,
    };
  }

  private toChunk(row: any): Chunk {
    return {
      id: row.id,
      videoId: row.video_id,
      documentId: row.document_id,
      content: row.content,
      startTime: row.start_time,
      chunkIndex: row.chunk_index,
      sourceType: row.source_type,
    };
  }

  private toDocument(row: any): Document {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      docType: row.doc_type,
      sourceUrl: row.source_url,
      status: row.status,
      addedAt: row.added_at,
    };
  }

  private toConversation(row: any): Conversation {
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      sourceVideoIds: row.source_video_ids,
      sourceDocumentIds: row.source_document_ids,
      askedAt: row.asked_at,
      source: row.source,
    };
  }

  addVideo(video: InsertVideo): Video {
    const stmt = this.db.prepare(`
      INSERT INTO videos (title, loom_url, loom_id, transcript, visual_context, duration, thumbnail_url, status, error_message, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      video.title, video.loomUrl, video.loomId,
      video.transcript ?? null, video.visualContext ?? null,
      video.duration ?? null, video.thumbnailUrl ?? null,
      video.status, video.errorMessage ?? null, video.addedAt
    );
    return this.getVideo(result.lastInsertRowid as number)!;
  }

  getVideo(id: number): Video | undefined {
    const row = this.db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    return row ? this.toVideo(row) : undefined;
  }

  getVideoByLoomId(loomId: string): Video | undefined {
    const row = this.db.prepare("SELECT * FROM videos WHERE loom_id = ?").get(loomId);
    return row ? this.toVideo(row) : undefined;
  }

  getAllVideos(): Video[] {
    const rows = this.db.prepare("SELECT * FROM videos ORDER BY added_at DESC").all();
    return rows.map((r: any) => this.toVideo(r));
  }

  updateVideoStatus(id: number, status: string, transcript?: string, errorMessage?: string, visualContext?: string): Video | undefined {
    const video = this.getVideo(id);
    if (!video) return undefined;

    const newTranscript = transcript !== undefined ? transcript : video.transcript;
    const newError = errorMessage !== undefined ? errorMessage : video.errorMessage;
    const newVisual = visualContext !== undefined ? visualContext : video.visualContext;

    this.db.prepare(`
      UPDATE videos SET status = ?, transcript = ?, error_message = ?, visual_context = ? WHERE id = ?
    `).run(status, newTranscript, newError, newVisual, id);

    return this.getVideo(id);
  }

  updateVideoMetadata(id: number, title?: string, thumbnailUrl?: string): Video | undefined {
    const video = this.getVideo(id);
    if (!video) return undefined;

    const newTitle = title !== undefined ? title : video.title;
    const newThumb = thumbnailUrl !== undefined ? thumbnailUrl : video.thumbnailUrl;

    this.db.prepare(`
      UPDATE videos SET title = ?, thumbnail_url = ? WHERE id = ?
    `).run(newTitle, newThumb, id);

    return this.getVideo(id);
  }

  deleteVideo(id: number): void {
    this.db.prepare("DELETE FROM videos WHERE id = ?").run(id);
    this.deleteChunksByVideoId(id);
  }

  addChunk(chunk: InsertChunk): Chunk {
    const stmt = this.db.prepare(`
      INSERT INTO chunks (video_id, document_id, content, start_time, chunk_index, source_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      chunk.videoId ?? null, chunk.documentId ?? null,
      chunk.content, chunk.startTime ?? null,
      chunk.chunkIndex, chunk.sourceType
    );
    const row = this.db.prepare("SELECT * FROM chunks WHERE id = ?").get(result.lastInsertRowid as number);
    return this.toChunk(row);
  }

  getChunksByVideoId(videoId: number): Chunk[] {
    const rows = this.db.prepare("SELECT * FROM chunks WHERE video_id = ? ORDER BY chunk_index").all(videoId);
    return rows.map((r: any) => this.toChunk(r));
  }

  getChunksByDocumentId(documentId: number): Chunk[] {
    const rows = this.db.prepare("SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index").all(documentId);
    return rows.map((r: any) => this.toChunk(r));
  }

  getAllChunks(): Chunk[] {
    const rows = this.db.prepare("SELECT * FROM chunks").all();
    return rows.map((r: any) => this.toChunk(r));
  }

  deleteChunksByVideoId(videoId: number): void {
    this.db.prepare("DELETE FROM chunks WHERE video_id = ?").run(videoId);
  }

  deleteChunksByDocumentId(documentId: number): void {
    this.db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);
  }

  searchChunks(query: string): Array<Chunk & { video?: Video; document?: Document }> {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return [];

    // Get all chunks and score them (same logic as before but from DB)
    const allChunks = this.db.prepare("SELECT * FROM chunks").all();
    const results: Array<{ chunk: Chunk; video?: Video; document?: Document; score: number }> = [];

    for (const row of allChunks) {
      const chunk = this.toChunk(row);
      const contentLower = chunk.content.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (contentLower.includes(word)) {
          score++;
        }
      }
      if (score > 0) {
        if (chunk.sourceType === "video" && chunk.videoId) {
          const video = this.getVideo(chunk.videoId);
          if (video) {
            results.push({ chunk, video, score });
          }
        } else if (chunk.sourceType === "document" && chunk.documentId) {
          const doc = this.getDocument(chunk.documentId);
          if (doc) {
            results.push({ chunk, document: doc, score });
          }
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10).map((r) => ({ ...r.chunk, video: r.video, document: r.document }));
  }

  addDocument(doc: InsertDocument): Document {
    const stmt = this.db.prepare(`
      INSERT INTO documents (title, content, doc_type, source_url, status, added_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      doc.title, doc.content, doc.docType,
      doc.sourceUrl ?? null, doc.status, doc.addedAt
    );
    return this.getDocument(result.lastInsertRowid as number)!;
  }

  getDocument(id: number): Document | undefined {
    const row = this.db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    return row ? this.toDocument(row) : undefined;
  }

  getAllDocuments(): Document[] {
    const rows = this.db.prepare("SELECT * FROM documents ORDER BY added_at DESC").all();
    return rows.map((r: any) => this.toDocument(r));
  }

  deleteDocument(id: number): void {
    this.db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    this.deleteChunksByDocumentId(id);
  }

  addConversation(convo: InsertConversation): Conversation {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (question, answer, source_video_ids, source_document_ids, asked_at, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      convo.question, convo.answer,
      convo.sourceVideoIds, convo.sourceDocumentIds ?? null,
      convo.askedAt, convo.source
    );
    const row = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(result.lastInsertRowid as number);
    return this.toConversation(row);
  }

  getRecentConversations(limit: number): Conversation[] {
    const rows = this.db.prepare("SELECT * FROM conversations ORDER BY asked_at DESC LIMIT ?").all(limit);
    return rows.map((r: any) => this.toConversation(r));
  }
}

export const storage = new DatabaseStorage();
