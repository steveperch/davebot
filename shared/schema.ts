import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  loomUrl: text("loom_url").notNull(),
  loomId: text("loom_id").notNull(),
  transcript: text("transcript"),
  duration: integer("duration"),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  addedAt: text("added_at").notNull(),
});

export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id"),
  documentId: integer("document_id"),
  content: text("content").notNull(),
  startTime: integer("start_time"),
  chunkIndex: integer("chunk_index").notNull(),
  sourceType: text("source_type").notNull().default("video"), // "video" | "document"
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  docType: text("doc_type").notNull().default("text"), // "text" | "url" | "pdf"
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("ready"),
  addedAt: text("added_at").notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sourceVideoIds: text("source_video_ids").notNull(),
  sourceDocumentIds: text("source_document_ids"),
  askedAt: text("asked_at").notNull(),
  source: text("source").notNull().default("web"),
});

export const insertVideoSchema = createInsertSchema(videos).omit({ id: true });
export const insertChunkSchema = createInsertSchema(chunks).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true });

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Chunk = typeof chunks.$inferSelect;
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
