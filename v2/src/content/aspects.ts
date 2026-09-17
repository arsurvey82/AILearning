/**
 * When each concept runs, and what of it survives into a downloaded model.
 *
 * The `trace` column is the reason this file exists. People assume a model file
 * contains the machinery that produced it, and it does not. Open a real
 * checkpoint and you will find tensors, a tokenizer and two small JSON files.
 * No loss function. No gradients. No optimiser. All of that was scaffolding for
 * a process that finished, and it was thrown away.
 *
 * So `trace: null` is the most useful value here, not a missing one. Saying
 * "nothing, it is not in there" teaches more about what a model is than any
 * amount of describing what a gradient does.
 *
 * Grounded against a real checkpoint: Llama 3.1 8B, 8.03B parameters across 32
 * decoder layers, as published in its model card and config.
 */

import type { Aspect } from './schema';

const LLAMA = 'https://huggingface.co/meta-llama/Llama-3.1-8B';

export const ASPECTS: Record<string, Aspect> = {
  /* ------------------------------------------------ the thing itself ---- */

  llm: {
    phase: 'both',
    trace: 'The whole file. Roughly 8 billion numbers plus a small config, and nothing else.',
    code: 'LlamaForCausalLM',
  },
  layer: {
    phase: 'both',
    trace: '32 groups of nine tensors, stored under model.layers.0 through model.layers.31.',
    code: 'LlamaDecoderLayer',
  },
  neuron: {
    phase: 'both',
    trace: 'One row of a weight matrix. It has no separate existence in the file.',
    code: 'a single dot product inside torch.matmul',
  },
  parameter: {
    phase: 'both',
    trace: 'Every value in every tensor. This is what you actually downloaded.',
    code: 'nn.Parameter',
  },
  tensor: {
    phase: 'both',
    trace: 'The storage format of the file itself.',
    code: 'torch.Tensor',
  },

  /* -------------------------------------------- exists only in flight ---- */

  attention: {
    phase: 'both',
    trace:
      'Only the Q, K, V and output weights. The attention scores everyone pictures are computed and discarded, never stored.',
    code: 'LlamaAttention.forward',
  },
  'attention-scores': {
    phase: 'both',
    trace: null,
    code: 'computed inside the attention kernel, freed immediately',
  },
  'attention-weights': {
    phase: 'both',
    trace: null,
    code: 'softmax over the scores, then discarded',
  },
  'weighted-sum': { phase: 'both', trace: null, code: 'att @ v' },
  query: { phase: 'both', trace: 'The Wq matrix. The queries themselves are not stored.', code: 'x @ Wq' },
  key: { phase: 'both', trace: 'The Wk matrix. The keys are recomputed or cached, never shipped.', code: 'x @ Wk' },
  value: { phase: 'both', trace: 'The Wv matrix, same as the others.', code: 'x @ Wv' },
  residual: { phase: 'both', trace: null, code: 'x = x + sublayer(x)' },
  normalization: {
    phase: 'both',
    trace: 'The learned gain and bias per layer. The normalising itself happens live.',
    code: 'nn.LayerNorm',
  },
  mlp: {
    phase: 'both',
    trace: 'Its weight matrices, which are most of the file.',
    code: 'LlamaMLP.forward',
  },
  embedding: {
    phase: 'both',
    trace: 'The token table, model.embed_tokens.weight.',
    code: 'nn.Embedding',
  },
  logits: { phase: 'both', trace: null, code: 'the output of the final matmul' },
  softmax: { phase: 'both', trace: null, code: 'F.softmax' },

  /* ------------------------------------------------- training only ------ */

  backprop: {
    phase: 'training',
    trace: null,
    code: 'loss.backward(), torch.autograd',
  },
  'gradient-descent': {
    phase: 'training',
    trace: null,
    code: 'torch.optim.Optimizer.step()',
  },
  derivative: { phase: 'training', trace: null, code: 'the chain rule, inside autograd' },
  pretraining: {
    phase: 'training',
    trace: 'Only its result. The data, the schedule and the optimiser state are all absent.',
    code: 'the training loop',
  },
  sft: { phase: 'training', trace: 'Only its result, folded into the same weights.', code: 'the training loop' },
  alignment: {
    phase: 'training',
    trace: 'Only its result. The reward model and the comparisons are not shipped.',
    code: 'PPO or DPO, over a separate reward model',
  },
  'lora-dora': {
    phase: 'training',
    trace: 'A separate small file of adapter weights, if you shipped one. Megabytes, not gigabytes.',
    code: 'peft.LoraConfig',
  },
  evaluation: { phase: 'training', trace: null, code: 'a held-out set and a scoring script' },
  'gather-data': { phase: 'setup', trace: null, code: 'cleaning and deduplication pipelines' },
  'train-tokenizer': {
    phase: 'setup',
    trace: 'tokenizer.json. Decided once, before training, and frozen forever after.',
    code: 'tokenizers, then PreTrainedTokenizerFast',
  },
  continual: { phase: 'training', trace: null, code: 'another training run, on the old weights' },

  /* ------------------------------------------------ inference only ------ */

  'kv-cache': {
    phase: 'inference',
    trace: null,
    code: 'DynamicCache, or vLLM PagedAttention',
  },
  sampling: {
    phase: 'inference',
    trace: 'generation_config.json, which holds the default temperature and top-p.',
    code: 'LogitsProcessor inside generate()',
  },
  'the-loop': { phase: 'inference', trace: null, code: 'the while loop inside generate()' },
  vllm: { phase: 'inference', trace: null, code: 'the serving engine, a separate program' },
  aibrix: { phase: 'inference', trace: null, code: 'the control plane, a separate program' },
  'agent-layer': { phase: 'inference', trace: null, code: 'your own loop, outside the model' },
  agentic: { phase: 'inference', trace: null, code: 'your own orchestration code' },
  'context-engineering': { phase: 'inference', trace: null, code: 'what you choose to put in the prompt' },
  'tool-design': { phase: 'inference', trace: 'Tool schemas live in your code, not in the model.', code: 'JSON schemas passed per request' },
  monitoring: { phase: 'inference', trace: null, code: 'logging and dashboards around the service' },
  gpu: { phase: 'both', trace: null, code: 'CUDA kernels' },
  'deploy-prep': {
    phase: 'inference',
    trace: 'Sometimes a second, smaller copy of the file with quantised tensors and their scales.',
    code: 'llm-compressor, TensorRT Model Optimizer',
  },

  /* --------------------------------------------------- setup only ------- */

  tokenization: {
    phase: 'both',
    trace: 'The vocabulary, in tokenizer.json.',
    code: 'PreTrainedTokenizerFast',
  },
  'token-id': { phase: 'both', trace: 'Implicit: it is a row number in the token table.', code: 'a list index' },
  /* -------------------- the rest, so every concept is answered ---------- */

  model: { phase: 'both', trace: 'A grouping. Its parts are the file; the heading is not.', code: 'the module graph as a whole' },
  foundations: { phase: 'both', trace: 'Nothing directly. The mathematics is in the operations, not stored as anything.', code: 'torch, and the linear algebra underneath it' },
  objects: { phase: 'both', trace: 'A grouping for the things that ARE the file.', code: 'nn.Module and nn.Parameter' },
  linalg: { phase: 'both', trace: null, code: 'torch.matmul and friends' },
  matrix: { phase: 'both', trace: 'Every weight in the file is one.', code: 'a 2-D torch.Tensor' },
  matmul: { phase: 'both', trace: null, code: 'torch.matmul' },
  'dot-product': { phase: 'both', trace: null, code: 'one row of a matmul' },
  vector: { phase: 'both', trace: 'Every row of every matrix is one.', code: 'a 1-D torch.Tensor' },
  calculus: { phase: 'training', trace: null, code: 'torch.autograd' },
  probability: { phase: 'both', trace: null, code: 'softmax, and the sampling that follows it' },
  architecture: { phase: 'both', trace: 'config.json, which records the shape: how many layers, how wide, how many heads.', code: 'LlamaConfig' },
  transformer: { phase: 'both', trace: 'The whole stack of decoder layers, which is nearly the entire file.', code: 'LlamaModel' },
  'up-projection': { phase: 'both', trace: 'The gate and up matrices, which are among the largest tensors in the file.', code: 'LlamaMLP.up_proj' },
  activation: { phase: 'both', trace: null, code: 'F.silu, or F.gelu' },
  'down-projection': { phase: 'both', trace: 'The down matrix, the same size again.', code: 'LlamaMLP.down_proj' },
  rope: { phase: 'both', trace: 'Usually nothing. The rotation is computed from the position, not looked up in a stored table.', code: 'apply_rotary_pos_emb' },
  unembedding: { phase: 'both', trace: 'Often nothing of its own, because it reuses the token table transposed.', code: 'lm_head, weights tied to embed_tokens' },
  build: { phase: 'training', trace: null, code: 'the whole training pipeline' },
  operations: { phase: 'inference', trace: null, code: 'the serving stack' },
  'training-path': { phase: 'training', trace: null, code: 'the offline half of the lifecycle' },
  'inference-path': { phase: 'inference', trace: null, code: 'the online half of the lifecycle' },
  feast: { phase: 'both', trace: null, code: 'a feature store, running beside the model' },
  kubeflow: { phase: 'training', trace: null, code: 'Kubernetes, or SLURM on an HPC cluster' },
  mlflow: { phase: 'training', trace: null, code: 'an experiment tracker and model registry' },

  dimension_placeholder: { phase: 'setup', trace: null },
};

delete (ASPECTS as Record<string, unknown>)['dimension_placeholder'];

export const PHASE_LABEL: Record<Aspect['phase'], string> = {
  setup: 'Before anything runs',
  training: 'Only while learning',
  inference: 'Only while answering',
  both: 'Both',
};

/** Concepts with nothing at all in the shipped file. Usually the interesting ones. */
export function leavesNoTrace(): string[] {
  return Object.entries(ASPECTS)
    .filter(([, a]) => a.trace === null)
    .map(([id]) => id);
}

/** Everything grouped by when it runs, for the summary table. */
export function byPhase(): Record<Aspect['phase'], string[]> {
  const out: Record<Aspect['phase'], string[]> = {
    setup: [],
    training: [],
    inference: [],
    both: [],
  };
  for (const [id, a] of Object.entries(ASPECTS)) out[a.phase].push(id);
  return out;
}

export const ASPECT_SOURCE = { label: 'Llama 3.1 8B model card and config', url: LLAMA };
