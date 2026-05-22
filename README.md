# 🧠 Parallel Sentiment Analysis Dashboard

A full-stack **Next.js** web application that analyzes text sentiment using **parallel Worker Threads** — combining Natural Language Processing (NLP) with Parallel & Distributed Computing (PDC) concepts.

Built by **Dheeraj** (CSC-23S-010), **Sania Ashraf** (CSC-23S-031), **Ali Raza** (CSC-23S-221)  
Sindh Madressatul Islam University — Computer Science Department

---

## 📌 What is this?

Upload any CSV or TXT file of text reviews (up to 200MB) and the app will:

- **Classify** each text as Positive, Negative, or Neutral using the AFINN-111 lexicon
- **Extract** real sentiment/feeling keywords (filters out product names, numbers, dates)
- **Benchmark** parallel vs sequential processing and show a live speedup graph
- **Visualize** results with sentiment distribution pie chart, top keywords bar chart, and a full scrollable results table

The key engineering achievement is the **Worker Thread pool** — texts are split across all CPU cores and processed simultaneously, achieving **55,000+ texts/second** and a **3–6x speedup** over single-threaded processing.

---

## ✨ Features

| Feature | Description |
|---|---|
| ⚡ Parallel Processing | Persistent Worker Thread pool — workers stay alive between requests |
| 📂 Large File Support | Streams files line-by-line via `ReadableStream` — no browser crash |
| 📊 Benchmark Mode | Runs both sequential & parallel, shows speedup comparison chart |
| 🔑 Smart Keywords | AFINN allowlist — only real feeling words shown (no product names / IDs) |
| 📜 Virtual Scroll | 1 million results = ~14 DOM nodes — no UI freeze |
| 🎨 Clean UI | Warm color palette, monospace font, recharts visualizations |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15+ (App Router) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| NLP | Custom AFINN-111 lexicon (no external ML model) |
| PDC | Node.js Worker Threads (built-in) |
| Package Manager | Yarn |

---

## 📁 Project Structure

```
sentiment-dashboard/
│
├── app/
│   ├── page.jsx                  # Main UI — file upload, mode selector, progress
│   └── api/
│       └── analyze/
│           └── route.js          # POST /api/analyze — validates & orchestrates
│
├── components/
│   ├── Dashboard.jsx             # Results dashboard with virtual scroll
│   ├── SentimentChart.jsx        # Pie chart — positive/negative/neutral
│   ├── KeywordsChart.jsx         # Horizontal bar chart — top keywords
│   └── SpeedupChart.jsx          # Bar chart — sequential vs parallel time
│
├── lib/
│   ├── workerPool.js             # Persistent Worker Thread pool (PDC core)
│   └── parallelProcessor.js      # Splits batches, dispatches to pool
│
└── next.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js **18+**
- Yarn

---

### 1. Clone the repository

```bash
git clone https://github.com/Dheerajkhatri69/SentimentAnalysis.git
cd SentimentAnalysis
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Run the development server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 How to Use

1. **Open** `http://localhost:3000`
2. **Enter text** — one review per line in the textarea, OR click **Upload CSV / TXT** to upload a file
3. **Try the sample** — click **Load Sample** to test with 12 pre-loaded reviews
4. **Select mode:**
   - ⚡ **Parallel** — uses Worker Threads only
   - ⏳ **Sequential** — single thread (baseline)
   - 📊 **Benchmark** — runs both and shows speedup comparison *(recommended)*
5. Click **Run Analysis →**
6. View results: sentiment breakdown, top keywords, speedup chart, and individual results table

---

## ⚙️ How It Works

### NLP Pipeline

Each text goes through this pipeline inside a Worker Thread:

```
Raw text
   ↓ Lowercase + strip punctuation (regex)
   ↓ Tokenize (whitespace split)
   ↓ Score each token against AFINN-111 lexicon
   ↓ score = Σ AFINN(token) / total_tokens
   ↓ Classify: score > 0.05 → positive | < -0.05 → negative | else → neutral
   ↓ Extract keywords: only tokens present in AFINN (feeling words only)
```

### PDC Architecture

```
Browser
  │
  ├── Streams CSV line-by-line (ReadableStream — never loads full file)
  ├── Batches texts (200/batch)
  └── Sends 4 concurrent HTTP requests simultaneously
             │
             ▼
    Next.js API Route (/api/analyze)
             │
             ▼
    Worker Thread Pool (N = CPU count, max 8)
    ┌──────────────────────────────────┐
    │  Worker 1 │ Worker 2 │ Worker 3 │ ...
    │  chunk 1  │ chunk 2  │ chunk 3  │
    └──────────────────────────────────┘
             │  Promise.all()
             ▼
    Merged results → response
             │
             ▼
    Browser merges all batch results
    → Virtual scroll renders only ~14 DOM rows
```

---

## 📊 Performance

| Metric | Value |
|---|---|
| Processing rate | **55,000+ texts/second** |
| Speedup (parallel vs sequential) | **3–6x** |
| 100MB file estimate | **~18 seconds** |
| Max file size | 200MB |
| DOM nodes for 1M results | ~14 (virtual scroll) |
| AFINN raw lookup vs natural library | **93x faster** |

---

## 🔬 API Reference

### `POST /api/analyze`

**Request body:**
```json
{
  "texts": ["I love this product!", "Terrible experience."],
  "mode": "both"
}
```

| Field | Type | Values |
|---|---|---|
| `texts` | `string[]` | Array of texts (max 500 per request) |
| `mode` | `string` | `"parallel"` \| `"sequential"` \| `"both"` |

**Response:**
```json
{
  "success": true,
  "count": 2,
  "mode": "both",
  "results": [
    {
      "text": "I love this product!",
      "sentiment": "positive",
      "score": 0.6,
      "keywords": [{ "word": "love", "count": 1 }],
      "wordCount": 4
    }
  ],
  "stats": {
    "sentimentCounts": { "positive": 1, "negative": 1, "neutral": 0 },
    "sentimentPercentages": { "positive": 50.0, "negative": 50.0, "neutral": 0.0 },
    "topKeywords": [{ "word": "love", "count": 1 }],
    "averageScore": 0.15
  },
  "benchmark": {
    "sequentialMs": 12,
    "parallelMs": 4,
    "speedup": 3.0,
    "numWorkers": 4
  }
}
```

### `GET /api/analyze`

Health check — returns endpoint info.

---

## 🧩 Key Engineering Decisions

### Why AFINN instead of a trained ML model?
- Zero training time — works out of the box
- Fully interpretable — every score is traceable to specific words
- 93x faster than `natural.SentimentAnalyzer` with Porter stemming

### Why Worker Threads instead of `child_process`?
- Shared memory via `SharedArrayBuffer` is possible
- Lower overhead than spawning separate processes
- Native to Node.js — no extra dependencies

### Why a persistent pool instead of spawning per request?
- Each Worker Thread takes ~200ms to initialize (`natural` + `compromise` libraries)
- Pool creates workers once at startup, reuses them for all requests
- Eliminates cold-start penalty entirely

### Why virtual scroll for results?
- 50,000 DOM nodes = browser freeze/crash
- Virtual scroll keeps exactly ~14 rows in DOM at any time
- Implemented from scratch (no library) to avoid Next.js 16 Turbopack incompatibilities

---

## 📦 Scripts

```bash
yarn dev        # Start development server (http://localhost:3000)
yarn build      # Build for production
yarn start      # Start production server
yarn lint       # Run ESLint
```

---

## 👥 Team

| Name | Roll No. | Contribution |
|---|---|---|
| Dheeraj | CSC-23S-010 | Backend: Worker Pool, NLP Engine, API Routes |
| Sania Ashraf | CSC-23S-031 | Frontend: UI, File Streaming, Progress Tracking |
| Ali Raza | CSC-23S-221 | Charts, Benchmark Visualization, Testing & Docs |

---

## 📄 License

This project was developed as an academic submission for the NLP and PDC courses at Sindh Madressatul Islam University. For educational use only.
