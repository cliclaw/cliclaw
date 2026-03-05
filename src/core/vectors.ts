/**
 * File-based vector memory using TF-IDF for semantic search.
 * No external dependencies — pure math on strings, stored as JSON.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** A single memory entry with its precomputed TF-IDF vector */
export interface VectorEntry {
  id: string;
  text: string;
  timestamp: string;
  terms: Record<string, number>;
}

export interface VectorIndex {
  entries: VectorEntry[];
  /** Document frequency: how many entries contain each term */
  df: Record<string, number>;
  totalDocs: number;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "it", "in", "on", "at", "to", "of", "for", "and",
  "or", "but", "not", "with", "this", "that", "from", "by", "as", "be", "was",
  "are", "were", "been", "has", "have", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "can", "shall", "no", "yes",
  "so", "if", "then", "than", "too", "very", "just", "about", "up", "out",
  "all", "its", "my", "we", "our", "you", "your", "they", "their", "he",
  "she", "his", "her", "i", "me", "us", "them", "what", "which", "who",
  "when", "where", "how", "why", "each", "every", "any", "some", "more",
]);

/** Tokenize text into normalized terms */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/** Compute term frequency (normalized) for a token list */
function computeTF(tokens: string[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(freq), 1);
  const tf: Record<string, number> = {};
  for (const [term, count] of Object.entries(freq)) {
    tf[term] = count / max;
  }
  return tf;
}

/** Cosine similarity between two sparse vectors */
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, val] of Object.entries(a)) {
    magA += val * val;
    const bVal = b[term];
    if (bVal !== undefined) {
      dot += val * bVal;
    }
  }
  for (const val of Object.values(b)) {
    magB += val * val;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Compute TF-IDF vector for a query against the index */
function queryVector(query: string, index: VectorIndex): Record<string, number> {
  const tokens = tokenize(query);
  const tf = computeTF(tokens);
  const tfidf: Record<string, number> = {};

  for (const [term, tfVal] of Object.entries(tf)) {
    const docFreq = index.df[term] ?? 0;
    const idf = docFreq > 0 ? Math.log(index.totalDocs / docFreq) : 0;
    tfidf[term] = tfVal * idf;
  }

  return tfidf;
}

function vectorIndexPath(memoryDir: string): string {
  return join(memoryDir, "vectors.json");
}

/** Load or create the vector index */
export function loadVectorIndex(memoryDir: string): VectorIndex {
  const indexPath = vectorIndexPath(memoryDir);
  if (existsSync(indexPath)) {
    try {
      const raw = readFileSync(indexPath, "utf-8");
      return JSON.parse(raw) as VectorIndex;
    } catch {
      // Corrupted — rebuild
    }
  }
  return { entries: [], df: {}, totalDocs: 0 };
}

/** Save the vector index to disk */
export function saveVectorIndex(memoryDir: string, index: VectorIndex): void {
  mkdirSync(memoryDir, { recursive: true });
  writeFileSync(vectorIndexPath(memoryDir), JSON.stringify(index));
}

/** Rebuild document frequency from all entries */
function rebuildDF(entries: VectorEntry[]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const entry of entries) {
    for (const term of Object.keys(entry.terms)) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }
  return df;
}

/** Add a memory entry to the vector index */
export function indexMemoryEntry(
  memoryDir: string,
  text: string,
  timestamp?: string,
): void {
  const index = loadVectorIndex(memoryDir);
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tokens = tokenize(text);
  if (tokens.length === 0) return;

  const tf = computeTF(tokens);
  const entry: VectorEntry = {
    id,
    text,
    timestamp: timestamp ?? new Date().toISOString(),
    terms: tf,
  };

  index.entries.push(entry);
  // Update DF for new terms
  for (const term of Object.keys(tf)) {
    index.df[term] = (index.df[term] ?? 0) + 1;
  }
  index.totalDocs = index.entries.length;

  saveVectorIndex(memoryDir, index);
}

/** Search memory entries by semantic similarity, returns top-k results */
export function searchVectorMemory(
  memoryDir: string,
  query: string,
  topK = 5,
): Array<{ entry: VectorEntry; score: number }> {
  const index = loadVectorIndex(memoryDir);
  if (index.entries.length === 0) return [];

  const qVec = queryVector(query, index);
  if (Object.keys(qVec).length === 0) return [];

  // Compute TF-IDF vectors for each entry and score
  const scored = index.entries.map((entry) => {
    const tfidf: Record<string, number> = {};
    for (const [term, tfVal] of Object.entries(entry.terms)) {
      const docFreq = index.df[term] ?? 1;
      const idf = Math.log(index.totalDocs / docFreq);
      tfidf[term] = tfVal * idf;
    }
    return { entry, score: cosineSimilarity(qVec, tfidf) };
  });

  return scored
    .filter((s) => s.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Rebuild the entire vector index from MEMORY.md content */
export function rebuildVectorIndex(memoryDir: string, memoryContent: string): void {
  const sections = memoryContent.split(/^## /m).slice(1); // Split by ## headers
  const entries: VectorEntry[] = [];

  for (const section of sections) {
    const lines = section.split("\n");
    const header = lines[0]?.trim() ?? "";
    const body = lines.slice(1).join("\n").trim();
    if (!body || body.length < 10) continue;

    // Extract timestamp from header like "2026-03-05 12:00 — agent"
    const tsMatch = header.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
    const timestamp = tsMatch?.[1] ?? new Date().toISOString();

    const tokens = tokenize(body);
    if (tokens.length === 0) continue;

    entries.push({
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: body,
      timestamp,
      terms: computeTF(tokens),
    });
  }

  const df = rebuildDF(entries);
  const index: VectorIndex = { entries, df, totalDocs: entries.length };
  saveVectorIndex(memoryDir, index);
}

/** Get stats about the vector index */
export function getVectorStats(memoryDir: string): { entries: number; terms: number } {
  const index = loadVectorIndex(memoryDir);
  return {
    entries: index.entries.length,
    terms: Object.keys(index.df).length,
  };
}
