# Memory

CLIClaw uses TF-IDF-based semantic search over memory entries — no external APIs, no embedding services, works offline.

## Vector Memory

`src/core/vectors.ts` provides semantic search over memory entries:

- **No external dependencies** — pure math on strings, stored as JSON in `.cliclaw/memory/vectors.json`
- **Auto-indexed** — new memory entries are indexed on append
- **Semantic search** — `cliclaw memory search "query" --semantic` finds entries by meaning
- **Rebuild** — `cliclaw memory reindex` rebuilds the full index from MEMORY.md

## How it works

TF-IDF (Term Frequency-Inverse Document Frequency) measures how important a word is to a document in a collection:

- **TF** — How often a term appears in a document
- **IDF** — How rare a term is across all documents
- **Score** — TF × IDF gives each term a weight

When you search, CLIClaw:

1. Tokenizes your query
2. Computes TF-IDF weights for query terms
3. Compares against all indexed memory entries using cosine similarity
4. Returns entries ranked by relevance

## Usage

```bash
# Text search (regex pattern matching)
cliclaw memory search "bug fix"

# Semantic search (meaning-based)
cliclaw memory search "testing" --semantic

# Rebuild index after manual edits
cliclaw memory reindex
```

## Memory Management

Memory is stored in `.cliclaw/memory/MEMORY.md` and automatically trimmed when it exceeds `memoryMaxLines` (default 1100):

- Keeps first `memoryKeepHead` lines (default 80)
- Keeps last `memoryKeepTail` lines (default 850)
- Removes middle content

The prompt builder allocates `promptBudgets.memory` tokens (default 500) for memory content in each cycle.
