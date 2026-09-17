/**
 * What kind of claim each at-scale figure is, and therefore what can cite it.
 *
 * The audit that produced this file found 55 external figures with no source.
 * The obvious fix, bolting a URL onto each, would have been wrong, because the
 * 55 are not one kind of thing:
 *
 *   config      published in a model's own config or card. "Llama 3.1 8B is
 *               4,096 wide" is not an opinion and not an estimate; it is a
 *               field in config.json. The config IS the citation.
 *   derived     arithmetic on config values. "Two bytes per number at fp16, so
 *               a 4,096-wide vector is 8,192 bytes." Citing the config is
 *               honest here as long as the sum is shown, and the sums are
 *               checked by tests.
 *   convention  what people commonly do. "Temperature 0.7 to 1.0 for creative
 *               work" is in no config anywhere. Attaching a config URL to it
 *               would be worse than leaving it bare, because it would dress a
 *               habit up as a measurement.
 *
 * So convention figures are never auto-cited. They either carry a real source
 * of their own or the UI says plainly that they are common practice. That is
 * the same split this project already makes between a dated origin and an
 * opinion, applied to numbers.
 */

import type { ScaleNote, Source } from './schema';

export const GPT2_CONFIG: Source = {
  label: 'GPT-2 model card and config',
  url: 'https://huggingface.co/openai-community/gpt2',
};
export const LLAMA_CONFIG: Source = {
  label: 'Llama 3.1 8B model card and config',
  url: 'https://huggingface.co/meta-llama/Llama-3.1-8B',
};

export type Basis = 'config' | 'derived' | 'convention';

/**
 * Figures that no config backs, keyed `nodeId::label`.
 *
 * Listed explicitly rather than inferred. A default of "config" with a list of
 * exceptions is auditable; a heuristic that guesses from the text would be the
 * kind of thing that silently mislabels one entry and never gets caught.
 */
const CONVENTION = new Set([
  'model::Distinct architectures',
  'sampling::Typical temperature',
  'sampling::Typical top-p',
  'gradient-descent::Learning rate',
  'gradient-descent::Optimiser memory',
  'sft::Examples',
  'lora-dora::Typical rank',
  'lora-dora::Trainable share',
  'build::Share of total compute',
  'deploy-prep::Typical quality cost',
  'operations::Serving latency budget',
  'inference-path::Time to first token',
  'gpu::Typical serving GPU',
  'vllm::Page size',
  'matrix::Matrices per block',
  'layer::Parameter split per block',
  'mlp::Share of block parameters',
  'backprop::Cost vs forward pass',
]);

/** Figures that are arithmetic on published config values rather than fields. */
const DERIVED = new Set([
  'vector::Bytes per vector at fp16',
  'parameter::Bytes each at fp16',
  'architecture::Weights',
  'linalg::Multiplies per token',
  'matmul::Multiplies per token',
  'calculus::Gradients per step',
  'derivative::Derivatives per step',
  'objects::Weights',
  'attention-scores::Scale divisor',
  'key::Cached per token',
  'up-projection::Parameters',
  'pretraining::Memory vs serving',
  'deploy-prep::Weights at each precision',
  'lora-dora::Adapter file size',
  'mlflow::Artifact size',
]);

export function basisOf(nodeId: string, label: string): Basis {
  const k = `${nodeId}::${label}`;
  if (CONVENTION.has(k)) return 'convention';
  if (DERIVED.has(k)) return 'derived';
  return 'config';
}

/**
 * The sources that stand behind one figure, or an empty list when nothing does.
 *
 * An explicit source on the note always wins: it means somebody checked that
 * particular number against that particular paper.
 */
export function citationsFor(nodeId: string, s: ScaleNote): Source[] {
  if (s.source) return [s.source];
  const basis = basisOf(nodeId, s.label);
  if (basis === 'convention') return [];
  const out: Source[] = [];
  if (s.gpt2) out.push(GPT2_CONFIG);
  if (s.llama) out.push(LLAMA_CONFIG);
  return out;
}

/** True when the figure is a habit rather than a measurement, and must say so. */
export function isConvention(nodeId: string, s: ScaleNote): boolean {
  return !s.source && basisOf(nodeId, s.label) === 'convention';
}
