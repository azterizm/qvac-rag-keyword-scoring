# Keyword scoring in QVAC's RAG search

This repository reproduces three bugs in the keyword part of the search score in `@qvac/rag` 0.9.0, and shows one design point. Fixed vectors stand in for an embedding model, so each test reads the keyword score back exactly and needs no model.

Search ranks each candidate by 70% vector similarity and 30% keyword score, in `scoreDocuments` in `packages/rag/src/utils/helper.ts`. Both `HyperDBAdapter` and `TurboVecAdapter` use it for the final ranking. The keyword score splits the query on whitespace and counts a query word as found if it appears anywhere in the text.

## What the tests show

A question mark stops the last query word from matching. Against "Refund policy: you can return items within 30 days.", the query "refund policy?" gets a keyword score of 0.35 and "refund policy" gets 0.70.

Short query words match inside other words. Against "This page lists delivery times.", the query "is" gets 0.70 because "is" appears inside "This", and "was" gets 0.

A query that starts or ends with a space gets an empty query word, and an empty word matches every document. Against "Delivery takes three days.", which contains neither word, " refund policy" gets 0.23 and "refund policy" gets 0.

Common words count as much as the topic word. When the refund policy and a shipping page are equally close in meaning, the shipping page ranks first for "What is the refund policy?". It shares "what", "is" and "the" with the question and gets 0.67, while the policy shares only "refund" and gets 0.14.

## How much this matters

The keyword score is 30% of the total, so it decides the order among documents that are close in meaning. Documents far apart in meaning keep their order. With all-MiniLM-L6-v2 embeddings, the refund policy has a cosine similarity of 0.71 to the question and the shipping page 0.10, and the policy ranks first.

## A fix

Drop empty query words, strip punctuation from the edges of each word, and match whole words. Whole-word matching needs care in languages written without spaces, such as Chinese and Japanese, where a substring match is what finds a word today. `Intl.Segmenter` can split those into words where the runtime provides it. Weighting each word by how rare it is among the candidates would stop common words counting as much as the topic word.

## Run the tests

`@qvac/rag` 0.9.0 does not import on Node.js. Its `imports` map points the `node` condition at `node:crypto`, `node:fs` and `node:path`, and Node rejects those targets with `ERR_INVALID_PACKAGE_TARGET`. Before the tests run, `npm test` changes them to the plain names `crypto`, `fs` and `path` in the installed copy, which is the fix proposed upstream.

```bash
npm install
node check-import.mjs
npm test
```

The first command prints `ERR_INVALID_PACKAGE_TARGET`. The second applies the import fix and runs the 4 tests.

The tests ran on Node.js 26.7.0 and macOS 26.6.2, with @qvac/rag 0.9.0, corestore 7.16.1 and brittle 4.5.0. The import error is the same on Node.js 22.23.4 and 24.22.2, and the fix works on all three.
