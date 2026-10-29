import test from 'brittle'
import Corestore from 'corestore'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RAG, HyperDBAdapter } from '@qvac/rag'

// Fixed vectors stand in for an embedding model. Every query gets the vector
// [1, 0], and each document a vector with a chosen cosine similarity to it, so the
// vector part of the score is known and the keyword part can be read back exactly:
// score = 0.7 * cosine + 0.3 * keyword.
const vec = (cos) => [cos, Math.sqrt(1 - cos * cos)]
const COS = 0.8

async function search(query, docs) {
  const dir = mkdtempSync(join(tmpdir(), 'qvac-rag-'))
  const store = new Corestore(dir)
  const rag = new RAG({
    embeddingFunction: async (text) => (Array.isArray(text) ? text.map(() => vec(COS)) : vec(1)),
    dbAdapter: new HyperDBAdapter({ store })
  })
  await rag.ready()
  await rag.saveEmbeddings(
    docs.map((d) => ({ id: d.id, content: d.content, embedding: vec(COS), embeddingModelId: 'fixed' }))
  )
  const results = await rag.search(query, { topK: docs.length })
  await rag.close()
  await store.close()
  rmSync(dir, { recursive: true, force: true })
  return results.map((r) => ({ ...r, keyword: Number(((r.score - 0.7 * COS) / 0.3).toFixed(2)) }))
}

const answer = { id: 'answer', content: 'Refund policy: you can return items within 30 days.' }
const filler = { id: 'filler', content: 'This is what the shipping page says about delivery times.' }

test('a question mark stops the last query word from matching', async (t) => {
  const [withMark] = await search('refund policy?', [answer])
  const [without] = await search('refund policy', [answer])
  t.is(withMark.keyword, 0.35, '"refund policy?" keyword score 0.35')
  t.is(without.keyword, 0.7, '"refund policy" keyword score 0.70')
})

test('short query words match inside other words', async (t) => {
  // The document has no word "is". It contains "This", and "is" matches inside it.
  const doc = { id: 'doc', content: 'This page lists delivery times.' }
  const [hit] = await search('is', [doc])
  const [miss] = await search('was', [doc])
  t.is(hit.keyword, 0.7, '"is" keyword score 0.70')
  t.is(miss.keyword, 0, '"was" keyword score 0')
})

test('a leading space adds an empty query word that matches every document', async (t) => {
  // The document contains neither query word.
  const doc = { id: 'doc', content: 'Delivery takes three days.' }
  const [spaced] = await search(' refund policy', [doc])
  const [plain] = await search('refund policy', [doc])
  t.is(spaced.keyword, 0.23, '" refund policy" keyword score 0.23')
  t.is(plain.keyword, 0, '"refund policy" keyword score 0')
})

test('common words count as much as the topic word', async (t) => {
  // Both documents are equally close in meaning, so the keyword score decides.
  const results = await search('What is the refund policy?', [answer, filler])
  t.is(results[0].id, 'filler', 'the shipping page ranks first')
  t.is(results.find((r) => r.id === 'filler').keyword, 0.67, 'shipping page keyword score 0.67')
  t.is(results.find((r) => r.id === 'answer').keyword, 0.14, 'refund policy keyword score 0.14')
})
