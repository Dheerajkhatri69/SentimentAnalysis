"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import SentimentChart from "./SentimentChart";
import KeywordsChart from "./KeywordsChart";
import SpeedupChart from "./SpeedupChart";
import { colors } from "../lib/colors";

const ROW_HEIGHT = 72;
const VISIBLE_BUFFER = 5; // extra rows above/below viewport

const sentimentColor = colors.sentiment;

// Custom virtual scroll hook — renders only visible rows
function useVirtualScroll(totalItems, containerHeight) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + VISIBLE_BUFFER * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);

  const onScroll = useCallback((e) => setScrollTop(e.currentTarget.scrollTop), []);

  return { startIndex, endIndex, totalHeight: totalItems * ROW_HEIGHT, onScroll };
}

function VirtualResultsList({ results }) {
  const containerHeight = ROW_HEIGHT * 8; // show 8 rows
  const { startIndex, endIndex, totalHeight, onScroll } = useVirtualScroll(results.length, containerHeight);

  return (
    <div
      onScroll={onScroll}
      style={{ height: containerHeight, overflowY: "auto", background: colors.background.secondary, position: "relative" }}
    >
      {/* Full height spacer so scrollbar is correct size */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* Only render visible rows */}
        {results.slice(startIndex, endIndex + 1).map((r, i) => {
          const actualIndex = startIndex + i;
          return (
            <div
              key={actualIndex}
              style={{
                position: "absolute",
                top: actualIndex * ROW_HEIGHT,
                left: 0, right: 0,
                height: ROW_HEIGHT,
                borderBottom: `1px solid ${colors.border.default}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                padding: "12px 20px",
                boxSizing: "border-box",
              }}
              onMouseEnter={e => e.currentTarget.style.background = colors.background.hover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: colors.text.label, fontSize: 12, width: 24, flexShrink: 0, marginTop: 2 }}>
                {String(actualIndex + 1).padStart(2, "0")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: colors.text.primary, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.text}
                </p>
                {r.keywords.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {r.keywords.slice(0, 4).map((k) => (
                      <span key={k.word} style={{ fontSize: 11, padding: "1px 8px", borderRadius: 4, background: colors.background.primary, color: colors.text.secondary, border: `1px solid ${colors.border.default}` }}>
                        {k.word}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: sentimentColor[r.sentiment] }}>
                  {r.sentiment}
                </span>
                <div style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
                  {r.score > 0 ? "+" : ""}{r.score}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard({ data }) {
  const { stats, results, benchmark, count, mode } = data;
  const [sentimentFilter, setSentimentFilter] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: colors.border.default }} />
        <span className="text-xs tracking-widest uppercase" style={{ color: colors.background.secondary }}>Results</span>
        <div className="flex-1 h-px" style={{ background: colors.border.default }} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Texts", value: count.toLocaleString() },
          { label: "Avg Score",   value: stats.averageScore > 0 ? `+${stats.averageScore}` : stats.averageScore },
          { label: "Most Common", value: Object.entries(stats.sentimentCounts).sort((a, b) => b[1] - a[1])[0][0] },
          { label: "Top Keyword", value: stats.topKeywords[0]?.word || "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 shadow-sm"
            style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: colors.text.secondary }}>{s.label}</div>
            <div className="text-2xl font-bold capitalize" style={{ color: colors.text.primary }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl p-5 shadow-sm" style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
          <div className="text-xs uppercase tracking-widest mb-4" style={{ color: colors.accent.primary }}>Sentiment Distribution</div>
          <SentimentChart data={stats.sentimentCounts} />
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
          <div className="text-xs uppercase tracking-widest mb-4" style={{ color: colors.accent.primary }}>Top Keywords</div>
          <KeywordsChart data={stats.topKeywords} />
        </div>
      </div>

      {/* Benchmark */}
      {mode === "both" && benchmark?.sequentialMs && benchmark?.parallelMs && (
        <div className="rounded-xl p-5 shadow-sm" style={{ background: colors.background.primary, border: `1px solid ${colors.border.default}` }}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: colors.accent.primary }}>PDC Benchmark — Parallel vs Sequential</div>
          <p className="text-xs mb-5" style={{ color: colors.text.muted }}>{benchmark.numWorkers} worker threads</p>
          <SpeedupChart benchmark={benchmark} />
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: colors.accent.primary }} />
            <span className="text-sm" style={{ color: colors.text.primary }}>
              Parallel was{" "}
              <span className="font-bold" style={{ color: colors.accent.primary }}>{benchmark.speedup}x faster</span>
              {" "}({benchmark.parallelMs}ms vs {benchmark.sequentialMs}ms)
            </span>
          </div>
        </div>
      )}

      {/* Virtual Scroll Results Table */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${colors.border.default}` }}>
        <div className="px-5 py-4"
          style={{ background: colors.background.primary, borderBottom: `1px solid ${colors.border.default}` }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest" style={{ color: colors.accent.primary }}>
              Individual Results
            </span>
            <span className="text-xs" style={{ color: colors.text.muted }}>
              {sentimentFilter === "all" ? results.length : results.filter(r => r.sentiment === sentimentFilter).length} / {results.length.toLocaleString()} entries
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "positive", "negative", "neutral"].map((filter) => {
              const count = filter === "all" ? results.length : results.filter(r => r.sentiment === filter).length;
              return (
                <button
                  key={filter}
                  onClick={() => setSentimentFilter(filter)}
                  className="px-3 py-1.5 rounded-lg text-xs uppercase tracking-widest transition-all font-semibold"
                  style={{
                    background: sentimentFilter === filter ? (filter === "all" ? colors.accent.primary : sentimentColor[filter]) : colors.background.secondary,
                    color: sentimentFilter === filter ? colors.background.primary : colors.text.secondary,
                    border: sentimentFilter === filter ? "none" : `1px solid ${colors.border.default}`,
                  }}>
                  {filter === "all" ? "All" : filter} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <VirtualResultsList results={sentimentFilter === "all" ? results : results.filter(r => r.sentiment === sentimentFilter)} />
      </div>
    </div>
  );
}
