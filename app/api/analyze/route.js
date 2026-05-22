import { processSequential, processParallel, computeStats } from "@/lib/parallelProcessor";

export async function POST(request) {
  try {
    const body = await request.json();
    const { texts, mode = "parallel" } = body;

    // --- Validation ---
    if (!texts || !Array.isArray(texts)) {
      return Response.json(
        { error: "texts must be an array of strings" },
        { status: 400 }
      );
    }
    if (texts.length === 0) {
      return Response.json(
        { error: "texts array cannot be empty" },
        { status: 400 }
      );
    }
    if (texts.length > 500) {
      return Response.json(
        { error: "Maximum 500 texts per request" },
        { status: 400 }
      );
    }

    // Sanitize: ensure all entries are strings
    const cleanTexts = texts.map((t) =>
      typeof t === "string" ? t.trim() : String(t).trim()
    );

    // --- Run NLP processing ---
    let processingResult;

    if (mode === "both") {
      // Run both modes to generate speedup comparison
      const [seqResult, parResult] = await Promise.all([
        processSequential([...cleanTexts]),
        processParallel([...cleanTexts]),
      ]);

      const speedup = +(seqResult.duration / parResult.duration).toFixed(2);

      processingResult = {
        results: parResult.results,
        stats: computeStats(parResult.results),
        benchmark: {
          sequentialMs: seqResult.duration,
          parallelMs: parResult.duration,
          speedup,
          numWorkers: parResult.numWorkers,
          textsPerWorker: parResult.chunkSize,
          improvement: `${speedup}x faster with ${parResult.numWorkers} threads`,
        },
      };
    } else if (mode === "sequential") {
      const seqResult = await processSequential(cleanTexts);
      processingResult = {
        results: seqResult.results,
        stats: computeStats(seqResult.results),
        benchmark: {
          sequentialMs: seqResult.duration,
          parallelMs: null,
          speedup: 1,
          numWorkers: 1,
        },
      };
    } else {
      // Default: parallel
      const parResult = await processParallel(cleanTexts);
      processingResult = {
        results: parResult.results,
        stats: computeStats(parResult.results),
        benchmark: {
          sequentialMs: null,
          parallelMs: parResult.duration,
          speedup: null,
          numWorkers: parResult.numWorkers,
          textsPerWorker: parResult.chunkSize,
        },
      };
    }

    return Response.json({
      success: true,
      count: cleanTexts.length,
      mode,
      ...processingResult,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return Response.json(
      { error: "Internal server error", detail: error.message },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return Response.json({
    status: "ok",
    endpoint: "POST /api/analyze",
    body: {
      texts: ["array of strings"],
      mode: "parallel | sequential | both",
    },
  });
}
