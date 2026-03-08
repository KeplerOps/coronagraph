// ---------------------------------------------------------------------------
// Embedding generation via Voyage AI API
// ---------------------------------------------------------------------------

import { getConfig } from "../config.ts";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

// -- Voyage API response shape -----------------------------------------------

interface VoyageEmbeddingData {
  object: string;
  index: number;
  embedding: number[];
}

interface VoyageResponse {
  object: string;
  data: VoyageEmbeddingData[];
  model: string;
  usage: { total_tokens: number };
}

/**
 * Generate an embedding vector for the supplied text using the Voyage AI API.
 *
 * Returns `null` when no EMBEDDING_API_KEY is configured or if the API call
 * fails -- the pipeline will simply store the item without an embedding.
 */
export async function embed(text: string): Promise<number[] | null> {
  const config = getConfig();

  if (!config.EMBEDDING_API_KEY) {
    console.log("[embedder] No EMBEDDING_API_KEY configured, skipping");
    return null;
  }

  const model = config.EMBEDDING_MODEL; // default: "voyage-3"

  // Truncate to avoid excessive token usage -- Voyage models accept up to
  // ~32 000 tokens but we rarely need more than a few thousand characters.
  const truncated = text.slice(0, 8000);

  try {
    const res = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: truncated,
        input_type: "document",
        output_dimension: config.EMBEDDING_DIMENSIONS,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Voyage API responded ${res.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as VoyageResponse;

    const vector = data.data?.[0]?.embedding;
    if (!vector || !Array.isArray(vector)) {
      console.error("[embedder] Unexpected response shape from Voyage API");
      return null;
    }

    return vector;
  } catch (err) {
    console.error("[embedder] Error:", err);
    return null;
  }
}
