const { Worker } = require("worker_threads");
const path = require("path");
const os = require("os");

class WorkerPool {
  constructor(size) {
    this.size = size;
    this.workers = [];
    this.queue = [];
    this.free = [];
    this._taskCounter = 0;
    this._pending = new Map();

    for (let i = 0; i < size; i++) {
      this._spawnWorker(i);
    }
  }

  _spawnWorker(id) {
    const worker = new Worker(`
      const { parentPort } = require("worker_threads");
      const natural = require("natural");
      const nlp = require("compromise");

      const analyzer = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");
      const tokenizer = new natural.WordTokenizer();

      // Only real sentiment/feeling words are shown as keywords
      // Numbers, product names, dates, IDs are all excluded automatically
      const sentimentWords = new Set([
        // Positive feeling words
        "love","loved","loving","like","liked","amazing","awesome","excellent",
        "fantastic","wonderful","great","good","best","perfect","beautiful",
        "brilliant","outstanding","superb","incredible","happy","pleased",
        "satisfied","delighted","impressed","recommend","recommended","worth",
        "helpful","easy","comfortable","smooth","fast","quick","reliable",
        "sturdy","solid","quality","durable","clean","clear","simple","nice",
        "neat","fine","fun","enjoy","enjoyed","enjoying","works","working",
        "powerful","effective","efficient","responsive","accurate","honest",
        "genuine","real","true","safe","secure","stylish","elegant","sleek",
        "affordable","reasonable","value","convenient","portable","lightweight",
        "strong","sharp","bright","vivid","crisp","cool","warm","soft","fresh",
        // Negative feeling words
        "hate","hated","hating","dislike","terrible","horrible","awful",
        "worst","bad","poor","cheap","broken","useless","waste","disappointed",
        "disappointing","frustrating","frustrated","annoying","annoyed","ugly",
        "slow","laggy","heavy","difficult","hard","complicated","confusing",
        "confused","unreliable","flimsy","fragile","fake","scam","overpriced",
        "expensive","defective","damaged","faulty","misleading","wrong","fail",
        "failed","failure","problem","problems","issue","issues","error",
        "crash","crashed","crashing","stopped","returned","returning",
        "refund","regret","regrets","avoid","never","beware","dangerous",
        "unsafe","uncomfortable","painful","hurt","damage","lost","missing",
        "late","delay","delayed","sticky","scratched","noisy","loud","leaking",
        "dirty","smelly","blurry","dim","weak","thin","rough","stiff","dead",
      ]);

      function analyzeText(text) {
        if (!text || typeof text !== "string" || text.trim() === "") {
          return { text, sentiment: "neutral", score: 0, keywords: [], entities: [], wordCount: 0 };
        }

        const tokens = tokenizer.tokenize(text.toLowerCase());
        const score = analyzer.getSentiment(tokens);
        let sentiment = "neutral";
        if (score > 0.05) sentiment = "positive";
        else if (score < -0.05) sentiment = "negative";

        // Only count tokens that are real sentiment/feeling words
        // This automatically excludes: numbers, product names, brands,
        // IDs, dates, generic nouns, stopwords, short words
        const freq = {};
        tokens.forEach((t) => {
          if (sentimentWords.has(t)) {
            freq[t] = (freq[t] || 0) + 1;
          }
        });

        const keywords = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([word, count]) => ({ word, count }));

        const doc = nlp(text);
        const entities = [
          ...doc.people().out("array").map((e) => ({ value: e, type: "Person" })),
          ...doc.places().out("array").map((e) => ({ value: e, type: "Place" })),
          ...doc.organizations().out("array").map((e) => ({ value: e, type: "Organization" })),
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

      parentPort.on("message", ({ taskId, chunk }) => {
        const results = chunk.map(analyzeText);
        parentPort.postMessage({ taskId, results });
      });
    `, { eval: true });

    worker.on("message", ({ taskId, results }) => {
      const resolve = this._pending.get(taskId);
      if (resolve) {
        this._pending.delete(taskId);
        resolve(results);
      }
      this.free.push(id);
      this._drain();
    });

    worker.on("error", (err) => {
      console.error("Worker " + id + " error:", err);
      this._spawnWorker(id);
    });

    this.workers[id] = worker;
    this.free.push(id);
  }

  _drain() {
    while (this.queue.length > 0 && this.free.length > 0) {
      const { taskId, chunk, resolve } = this.queue.shift();
      const workerId = this.free.pop();
      this._pending.set(taskId, resolve);
      this.workers[workerId].postMessage({ taskId, chunk });
    }
  }

  run(chunk) {
    return new Promise((resolve) => {
      const taskId = ++this._taskCounter;
      this.queue.push({ taskId, chunk, resolve });
      this._drain();
    });
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
  }
}

const POOL_SIZE = Math.min(os.cpus().length, 8);
let _pool = null;

function getPool() {
  if (!_pool) _pool = new WorkerPool(POOL_SIZE);
  return _pool;
}

module.exports = { getPool, POOL_SIZE };
