const { getPool, POOL_SIZE } = require("./workerPool");

/**
 * Process texts sequentially — single chunk, single worker slot
 */
async function processSequential(texts) {
  const start = Date.now();
  const pool = getPool();

  // Process all as one task (sequential = no splitting)
  const results = await pool.run(texts);

  return { results, duration: Date.now() - start };
}

/**
 * Process texts in parallel — split across all pool workers simultaneously
 */
async function processParallel(texts) {
  const start = Date.now();
  const pool = getPool();

  const numWorkers = Math.min(POOL_SIZE, texts.length);
  const chunkSize = Math.ceil(texts.length / numWorkers);

  // Split and dispatch all chunks simultaneously — no waiting between chunks
  const chunks = [];
  for (let i = 0; i < texts.length; i += chunkSize) {
    chunks.push(texts.slice(i, i + chunkSize));
  }

  const chunkResults = await Promise.all(chunks.map((chunk) => pool.run(chunk)));
  const results = chunkResults.flat();

  return {
    results,
    duration: Date.now() - start,
    numWorkers,
    chunkSize,
  };
}

/**
 * Aggregate stats across all results
 */
function computeStats(results) {
  const total = results.length;
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  const wordFreq = {};

  for (const { sentiment, keywords } of results) {
    sentimentCounts[sentiment]++;
    for (const { word, count } of keywords) {
      wordFreq[word] = (wordFreq[word] || 0) + count;
    }
  }

  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return {
    total,
    sentimentCounts,
    sentimentPercentages: {
      positive: +((sentimentCounts.positive / total) * 100).toFixed(1),
      negative: +((sentimentCounts.negative / total) * 100).toFixed(1),
      neutral: +((sentimentCounts.neutral / total) * 100).toFixed(1),
    },
    topKeywords,
    averageScore: +(results.reduce((s, r) => s + r.score, 0) / total).toFixed(4),
  };
}

module.exports = { processSequential, processParallel, computeStats };
