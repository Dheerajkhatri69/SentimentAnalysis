const { workerData, parentPort } = require("worker_threads");
const natural = require("natural");
const nlp = require("compromise");

const analyzer = new natural.SentimentAnalyzer(
  "English",
  natural.PorterStemmer,
  "afinn"
);
const tokenizer = new natural.WordTokenizer();

function analyzeText(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return {
      text,
      sentiment: "neutral",
      score: 0,
      keywords: [],
      entities: [],
      wordCount: 0,
    };
  }

  // Tokenize
  const tokens = tokenizer.tokenize(text.toLowerCase());

  // Sentiment score using AFINN lexicon
  const score = analyzer.getSentiment(tokens);
  let sentiment = "neutral";
  if (score > 0.05) sentiment = "positive";
  else if (score < -0.05) sentiment = "negative";

  // Keyword extraction — top 5 meaningful words (filter stopwords)
  const stopwords = new Set([
    "the","a","an","is","it","in","on","at","to","for","of","and",
    "or","but","i","you","he","she","we","they","this","that","was",
    "are","be","been","with","from","by","as","have","has","had",
    "not","do","did","will","would","could","should","my","your",
    "his","her","its","our","their","so","if","up","out","about",
  ]);
  const freq = {};
  tokens.forEach((t) => {
    if (t.length > 2 && !stopwords.has(t)) {
      freq[t] = (freq[t] || 0) + 1;
    }
  });
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  // Named entity extraction using compromise
  const doc = nlp(text);
  const people = doc.people().out("array");
  const places = doc.places().out("array");
  const organizations = doc.organizations().out("array");
  const entities = [
    ...people.map((e) => ({ value: e, type: "Person" })),
    ...places.map((e) => ({ value: e, type: "Place" })),
    ...organizations.map((e) => ({ value: e, type: "Organization" })),
  ].slice(0, 6);

  return {
    text: text.slice(0, 120) + (text.length > 120 ? "..." : ""),
    sentiment,
    score: parseFloat(score.toFixed(4)),
    keywords,
    entities,
    wordCount: tokens.length,
  };
}

// Process the chunk assigned to this worker
const { chunk, workerId } = workerData;
const results = chunk.map((text) => analyzeText(text));

parentPort.postMessage({ workerId, results });
