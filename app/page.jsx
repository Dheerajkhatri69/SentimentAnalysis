"use client";
import { useState, useRef, useEffect } from "react";
import Dashboard from "@/components/Dashboard";
import CanvasBackground from "@/components/CanvasBackground";
import { colors } from "@/lib/colors";

const BATCH_SIZE = 200;        // texts per request (was 50 — 4x bigger)
const CONCURRENT_BATCHES = 4;  // send 4 batches at once in parallel
const MAX_FILE_SIZE_MB = 200;

async function* streamFileLines(file) {
  const decoder = new TextDecoder("utf-8");
  const reader = file.stream().getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) { if (buffer.trim()) yield buffer.trim(); break; }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const clean = line.replace(/^"|"$/g, "").trim();
      if (clean) yield clean;
    }
  }
}

function mergeResults(batches) {
  const allResults = batches.flatMap((b) => b.results);
  const total = allResults.length;
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  const wordFreq = {};
  allResults.forEach(({ sentiment, keywords }) => {
    sentimentCounts[sentiment]++;
    keywords.forEach(({ word, count }) => { wordFreq[word] = (wordFreq[word] || 0) + count; });
  });
  const topKeywords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));
  const averageScore = +(allResults.reduce((s, r) => s + r.score, 0) / total).toFixed(4);
  const benchBatches = batches.filter((b) => b.benchmark?.sequentialMs);
  const totalSeq = benchBatches.reduce((s, b) => s + b.benchmark.sequentialMs, 0);
  const totalPar = benchBatches.reduce((s, b) => s + b.benchmark.parallelMs, 0);
  const speedup = totalPar > 0 ? +(totalSeq / totalPar).toFixed(2) : null;
  return {
    success: true, count: total, mode: batches[0]?.mode || "both",
    results: allResults,
    stats: { total, sentimentCounts, sentimentPercentages: {
      positive: +((sentimentCounts.positive / total) * 100).toFixed(1),
      negative: +((sentimentCounts.negative / total) * 100).toFixed(1),
      neutral: +((sentimentCounts.neutral / total) * 100).toFixed(1),
    }, topKeywords, averageScore },
    benchmark: speedup ? { sequentialMs: totalSeq, parallelMs: totalPar, speedup, numWorkers: batches[0]?.benchmark?.numWorkers, improvement: `${speedup}x faster` } : null,
  };
}

async function sendBatch(texts, mode, signal) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, mode }),
    signal,
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Batch failed"); }
  return res.json();
}

// Send batches with a concurrency limit
async function processBatchesConcurrently(batches, mode, signal, onProgress) {
  const results = new Array(batches.length);
  let completed = 0;
  let index = 0;

  async function worker() {
    while (index < batches.length) {
      const i = index++;
      results[i] = await sendBatch(batches[i], mode, signal);
      completed++;
      onProgress(completed, batches.length);
    }
  }

  // Launch CONCURRENT_BATCHES workers simultaneously
  await Promise.all(Array.from({ length: CONCURRENT_BATCHES }, worker));
  return results;
}

export default function Home() {
  const [texts, setTexts] = useState("");
  const [mode, setMode] = useState("both");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) { setError("Only CSV and TXT files are supported."); return; }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { setError(`File too large. Max ${MAX_FILE_SIZE_MB}MB.`); return; }
    setCsvFile(file); setTexts(""); setResult(null); setError(null); setDragOver(false);
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleAnalyze = async () => {
    setError(null); setResult(null); setProgress(null);
    let allTexts = [];

    if (csvFile) {
      try {
        for await (const line of streamFileLines(csvFile)) {
          allTexts.push(line);
          if (allTexts.length % 1000 === 0) setProgress({ stage: "parsing", done: allTexts.length });
        }
      } catch { setError("Failed to read file."); return; }
    } else {
      allTexts = texts.split("\n").map((t) => t.trim()).filter(Boolean);
    }

    if (allTexts.length === 0) { setError("No texts found."); return; }

    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const batches = [];
      for (let i = 0; i < allTexts.length; i += BATCH_SIZE) batches.push(allTexts.slice(i, i + BATCH_SIZE));

      setProgress({ stage: "analyzing", done: 0, total: allTexts.length, percent: 0, batches: 0, totalBatches: batches.length });

      const batchResults = await processBatchesConcurrently(
        batches, mode, abortRef.current.signal,
        (completedBatches, totalBatches) => {
          const done = Math.min(completedBatches * BATCH_SIZE, allTexts.length);
          setProgress({ stage: "analyzing", done, total: allTexts.length, percent: Math.round((done / allTexts.length) * 100), batches: completedBatches, totalBatches });
        }
      );

      setResult(mergeResults(batchResults));
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setLoading(false); setProgress(null);
    }
  };

  const handleCancel = () => { abortRef.current?.abort(); setLoading(false); setProgress(null); };
  const handleClear = () => { setTexts(""); setCsvFile(null); setResult(null); setError(null); setProgress(null); };

  // Auto-scroll to results when they appear
  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [result]);

  const sampleTexts = `I absolutely love this product! It's amazing and works perfectly.
This is the worst experience I've ever had. Terrible service.
The product is okay. Nothing special but gets the job done.
Fantastic quality and fast delivery. Will buy again!
Very disappointed. Broke after one day of use.
Not bad, not great. Just average for the price.
Outstanding customer support! They resolved my issue instantly.
Complete waste of money. Do not buy this.
Decent product. Does what it says on the box.
Incredible experience from start to finish. Highly recommend!
The app crashes constantly. Very frustrating to use daily.
Good value for money. Happy with the purchase overall.`;

  const textCount = csvFile ? null : texts.split("\n").filter((t) => t.trim()).length;

  return (
    <>
      <CanvasBackground />
      <main className="min-h-screen font-mono relative" style={{ background: "transparent", color: colors.text.primary }}>
      {/* Subtle dot pattern */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, ${colors.border.default} 1px, transparent 1px)`,
        backgroundSize: "28px 28px", opacity: 0.5,
      }} />

      <div className="relative max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: colors.background.secondary }} />
            <span className="text-xs tracking-[0.3em] uppercase" style={{ color: colors.background.secondary }}>
              NLP + Parallel Processing
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2" style={{ color: colors.text.primary }}>
            Sentiment<span style={{ color: colors.background.secondary }}>.</span>
            <span style={{ color: colors.text.secondary }}>Analysis</span>
          </h1>
          <p className="text-sm max-w-lg" style={{ color: colors.background.secondary }}>
            Analyze text sentiment using parallel worker threads. Handles large
            files via streaming — batched &amp; concurrent.
          </p>
        </div>

        {/* Input Card */}
        <div className="rounded-xl p-6 mb-6 shadow-sm" style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
          <div className="flex items-center justify-between mb-4">
            <label className="text-xs tracking-widest uppercase" style={{ color: colors.accent.primary }}>Input Texts</label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-xs px-3 py-1.5 rounded-lg transition-all" style={{ color: colors.accent.primary, border: `1px solid ${colors.accent.primary}`, background: "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = colors.interactive.accentHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Upload CSV / TXT
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
              </label>
              <button onClick={() => { setCsvFile(null); setTexts(sampleTexts); }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ color: colors.text.secondary, border: `1px solid ${colors.border.default}`, background: "transparent" }}>
                Load Sample
              </button>
              {(texts || csvFile) && (
                <button onClick={handleClear} className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: colors.button.negative, border: `1px solid ${colors.button.negative}40`, background: "transparent" }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {csvFile ? (
            <div className="h-52 rounded-lg flex flex-col items-center justify-center gap-3"
              style={{ background: colors.background.secondary, border: `1px solid ${colors.border.default}` }}>
              <div className="text-3xl">📄</div>
              <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>{csvFile.name}</div>
              <div className="text-xs" style={{ color: colors.text.secondary }}>
                {(csvFile.size / 1024 / 1024).toFixed(1)} MB — streamed in batches of {BATCH_SIZE}, {CONCURRENT_BATCHES} at a time
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="w-full h-52 rounded-lg p-4 transition-all cursor-pointer relative"
              style={{
                background: dragOver ? colors.interactive.accentLight : colors.background.secondary,
                border: dragOver ? `2px dashed ${colors.accent.primary}` : `1px solid ${colors.border.default}`,
              }}>
              <textarea value={texts} onChange={(e) => setTexts(e.target.value)}
                placeholder={"Enter one text per line...\n\nOr drag & drop a CSV/TXT file here\n\ne.g.\nI love this product!\nTerrible experience, never again."}
                className="w-full h-full text-sm resize-none focus:outline-none font-mono bg-transparent"
                style={{ color: colors.text.primary }} />
              {dragOver && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
                  <div className="text-center">
                    <div className="text-3xl mb-2">📁</div>
                    <div className="text-sm font-semibold" style={{ color: colors.accent.primary }}>Drop CSV or TXT file</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: colors.text.muted }}>
              {csvFile
                ? `File ready — ${CONCURRENT_BATCHES} concurrent batches of ${BATCH_SIZE}`
                : `${textCount} texts entered`}
            </span>
            <span className="text-xs" style={{ color: colors.text.muted }}>up to {MAX_FILE_SIZE_MB}MB</span>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="rounded-xl p-5 mb-6 shadow-sm" style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
          <label className="text-xs tracking-widest uppercase block mb-4" style={{ color: colors.accent.primary }}>Processing Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "parallel", label: "Parallel", desc: "Worker threads only", icon: "⚡" },
              { value: "sequential", label: "Sequential", desc: "Single thread only", icon: "⏳" },
              { value: "both", label: "Benchmark", desc: "Compare both modes", icon: "📊" },
            ].map((m) => (
              <button key={m.value} onClick={() => setMode(m.value)}
                className="p-4 rounded-lg text-left transition-all"
                style={{
                  border: mode === m.value ? `1px solid ${colors.accent.primary}` : `1px solid ${colors.border.default}`,
                  background: mode === m.value ? colors.interactive.accentLight : colors.background.secondary,
                  color: mode === m.value ? colors.text.primary : colors.text.secondary,
                }}>
                <div className="text-lg mb-1">{m.icon}</div>
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-xs opacity-60 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: colors.state.errorBg, border: `1px solid ${colors.state.errorBorder}`, color: colors.state.errorText }}>
            ⚠ {error}
          </div>
        )}

        {/* Progress Bar */}
        {loading && progress && (
          <div className="rounded-xl p-5 mb-6 shadow-sm" style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest" style={{ color: colors.accent.primary }}>
                {progress.stage === "parsing" ? "Parsing file..." : "Analyzing..."}
              </span>
              <span className="text-xs font-semibold" style={{ color: colors.accent.primary }}>
                {progress.stage === "analyzing"
                  ? `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} — batch ${progress.batches}/${progress.totalBatches} (${progress.percent}%)`
                  : `${progress.done.toLocaleString()} lines read...`}
              </span>
            </div>
            {progress.stage === "analyzing" && (
              <div className="w-full rounded-full h-2" style={{ background: colors.border.default }}>
                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%`, background: colors.accent.primary }} />
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
              Sending {CONCURRENT_BATCHES} batches simultaneously to the server
            </p>
          </div>
        )}

        {/* Analyze / Cancel */}
        {loading ? (
          <button onClick={handleCancel} className="w-full py-4 rounded-xl font-semibold text-sm tracking-widest uppercase transition-all"
            style={{ background: colors.state.errorBg, color: colors.state.errorText, border: `1px solid ${colors.state.errorBorder}` }}>
            Cancel
          </button>
        ) : (
          <button onClick={handleAnalyze} disabled={!texts.trim() && !csvFile}
            className="w-full py-4 rounded-xl font-semibold text-sm tracking-widest uppercase transition-all"
            style={{ background: colors.button.primary, color: colors.button.primaryText, opacity: (!texts.trim() && !csvFile) ? 0.4 : 1, cursor: (!texts.trim() && !csvFile) ? "not-allowed" : "pointer" }}>
            Run Analysis →
          </button>
        )}

        {/* Dashboard */}
        {result && <div ref={resultsRef} className="mt-10"><Dashboard data={result} /></div>}
      </div>
    </main>
    </>
  );
}
