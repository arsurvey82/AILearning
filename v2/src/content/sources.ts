/**
 * Citations for external figures.
 *
 * design-spec §8: "all 'at scale' figures get a verification pass at build
 * time." This module is that pass made durable, every number about a real
 * system points at where it was checked, so a future reader can re-check it
 * rather than trusting it.
 *
 * Verified 2026-08-05 against primary sources: model config files and the
 * vendors' own announcements, not secondary summaries.
 */

export interface Source {
  label: string;
  url: string;
}

export const SOURCES = {
  /** config.json. The authoritative architecture record. */
  gpt2Config: {
    label: 'GPT-2 config.json (openai-community/gpt2)',
    url: 'https://huggingface.co/openai-community/gpt2/raw/main/config.json',
  },
  /** OpenAI's GPT-2 announcement, WebText description. */
  gpt2Announcement: {
    label: 'OpenAI, “Better language models and their implications”',
    url: 'https://openai.com/index/better-language-models/',
  },
  /** Llama 3 8B config.json: hidden 4096, 32 layers, 32 heads, 8 KV heads, 14336 FFN, 128256 vocab, 8192 positions. */
  llama3Config: {
    label: 'Llama-3-8B config.json',
    url: 'https://huggingface.co/NousResearch/Meta-Llama-3-8B/raw/main/config.json',
  },
  /** Meta's Llama 3 announcement: 15T+ tokens, 8,192 training sequence length, 128K vocab, GQA on 8B. */
  llama3Announcement: {
    label: 'Meta AI, “Introducing Meta Llama 3”',
    url: 'https://ai.meta.com/blog/meta-llama-3/',
  },
  /** Llama 3.1 raised context to 128K, a DIFFERENT release from Llama 3. */
  llama31Announcement: {
    label: 'Meta AI, “Introducing Llama 3.1”',
    url: 'https://ai.meta.com/blog/meta-llama-3-1/',
  },
  /** Google's TPU paper. First public account of a systolic-array accelerator built for neural-network arithmetic in a datacentre. */
  tpuPaper: {
    label: 'Jouppi et al, In-Datacenter Performance Analysis of a Tensor Processing Unit',
    url: 'https://arxiv.org/abs/1704.04760',
  },
  /** Cerebras wafer-scale architecture. A whole model on one piece of silicon. */
  cerebrasWafer: {
    label: 'Cerebras wafer-scale cluster architecture, arXiv 2304.03208',
    url: 'https://arxiv.org/abs/2304.03208',
  },
  /** Groq LPU. Inference-only, deterministic, weights on-chip. */
  groqLpu: {
    label: 'Abts et al, Groq LPU architecture, arXiv 2408.00071',
    url: 'https://arxiv.org/abs/2408.00071',
  },
} as const satisfies Record<string, Source>;

/**
 * Verified reference configurations.
 *
 * Every value here was read from the config file cited beside it on
 * 2026-08-05, not recalled. Tests derive the at-scale figures from these
 * rather than trusting the prose, so a number in the content and a number in
 * the maths cannot drift apart without something going red.
 */
export const REFERENCE = {
  gpt2: {
    label: 'GPT-2 (124M)',
    source: SOURCES.gpt2Config,
    params: 124_000_000,
    layers: 12,
    dim: 768,
    heads: 12,
    kvHeads: 12, // no GQA, every head has its own K and V
    context: 1024,
    vocab: 50_257,
  },
  llama3_8b: {
    label: 'Llama-3-8B',
    source: SOURCES.llama3Config,
    params: 8_000_000_000,
    layers: 32,
    dim: 4096,
    heads: 32,
    kvHeads: 8, // grouped-query attention
    ffn: 14_336,
    context: 8192, // Llama 3. Llama 3.1 raised this to 128,000.
    vocab: 128_256,
    bytesPerValue: 2, // bfloat16
  },
} as const;

/** head_dim = model dimension ÷ number of attention heads. */
export function headDim(m: { dim: number; heads: number }): number {
  return m.dim / m.heads;
}

/** Bytes of KV cache per token: 2 (K and V) × layers × kv heads × head dim × bytes. */
export function kvBytesPerToken(m: {
  layers: number;
  kvHeads: number;
  dim: number;
  heads: number;
  bytesPerValue: number;
}): number {
  return 2 * m.layers * m.kvHeads * headDim(m) * m.bytesPerValue;
}
