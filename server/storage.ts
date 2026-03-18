import {
  type Video, type InsertVideo,
  type Chunk, type InsertChunk,
  type Document, type InsertDocument,
  type Conversation, type InsertConversation,
} from "@shared/schema";

export interface IStorage {
  addVideo(video: InsertVideo): Video;
  getVideo(id: number): Video | undefined;
  getVideoByLoomId(loomId: string): Video | undefined;
  getAllVideos(): Video[];
  updateVideoStatus(id: number, status: string, transcript?: string, errorMessage?: string): Video | undefined;
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

export class MemStorage implements IStorage {
  private videos: Map<number, Video> = new Map();
  private chunks: Map<number, Chunk> = new Map();
  private documents: Map<number, Document> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private nextVideoId = 1;
  private nextChunkId = 1;
  private nextDocId = 1;
  private nextConvoId = 1;

  addVideo(video: InsertVideo): Video {
    const id = this.nextVideoId++;
    const newVideo: Video = { ...video, id };
    this.videos.set(id, newVideo);
    return newVideo;
  }

  getVideo(id: number): Video | undefined {
    return this.videos.get(id);
  }

  getVideoByLoomId(loomId: string): Video | undefined {
    for (const video of this.videos.values()) {
      if (video.loomId === loomId) return video;
    }
    return undefined;
  }

  getAllVideos(): Video[] {
    return Array.from(this.videos.values()).sort((a, b) => {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }

  updateVideoStatus(id: number, status: string, transcript?: string, errorMessage?: string): Video | undefined {
    const video = this.videos.get(id);
    if (!video) return undefined;
    const updated: Video = {
      ...video,
      status,
      ...(transcript !== undefined ? { transcript } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    };
    this.videos.set(id, updated);
    return updated;
  }

  deleteVideo(id: number): void {
    this.videos.delete(id);
    this.deleteChunksByVideoId(id);
  }

  addChunk(chunk: InsertChunk): Chunk {
    const id = this.nextChunkId++;
    const newChunk: Chunk = { ...chunk, id };
    this.chunks.set(id, newChunk);
    return newChunk;
  }

  getChunksByVideoId(videoId: number): Chunk[] {
    return Array.from(this.chunks.values())
      .filter((c) => c.videoId === videoId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  getChunksByDocumentId(documentId: number): Chunk[] {
    return Array.from(this.chunks.values())
      .filter((c) => c.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  deleteChunksByVideoId(videoId: number): void {
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.videoId === videoId) {
        this.chunks.delete(id);
      }
    }
  }

  deleteChunksByDocumentId(documentId: number): void {
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
      }
    }
  }

  searchChunks(query: string): Array<Chunk & { video?: Video; document?: Document }> {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return [];

    const results: Array<{ chunk: Chunk; video?: Video; document?: Document; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (contentLower.includes(word)) {
          score++;
        }
      }
      if (score > 0) {
        if (chunk.sourceType === "video" && chunk.videoId) {
          const video = this.videos.get(chunk.videoId);
          if (video) {
            results.push({ chunk, video, score });
          }
        } else if (chunk.sourceType === "document" && chunk.documentId) {
          const doc = this.documents.get(chunk.documentId);
          if (doc) {
            results.push({ chunk, document: doc, score });
          }
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10).map((r) => ({ ...r.chunk, video: r.video, document: r.document }));
  }

  // Document methods
  addDocument(doc: InsertDocument): Document {
    const id = this.nextDocId++;
    const newDoc: Document = { ...doc, id };
    this.documents.set(id, newDoc);
    return newDoc;
  }

  getDocument(id: number): Document | undefined {
    return this.documents.get(id);
  }

  getAllDocuments(): Document[] {
    return Array.from(this.documents.values()).sort((a, b) => {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }

  deleteDocument(id: number): void {
    this.documents.delete(id);
    this.deleteChunksByDocumentId(id);
  }

  addConversation(convo: InsertConversation): Conversation {
    const id = this.nextConvoId++;
    const newConvo: Conversation = { ...convo, id };
    this.conversations.set(id, newConvo);
    return newConvo;
  }

  getRecentConversations(limit: number): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.askedAt).getTime() - new Date(a.askedAt).getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
