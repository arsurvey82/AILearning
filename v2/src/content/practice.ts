/**
 * The two lenses that are judgement rather than fact.
 *
 * Everything else in this project is checkable. A date has a paper. A number is
 * recomputed. A trace can be verified by opening a real checkpoint. These two
 * cannot be, and pretending otherwise would be worse than not writing them:
 *
 *   useCase   what this is for, in practice
 *   choose    when you would reach for it, and when you would not
 *
 * So every entry carries `confidence`, and the UI shows it. `sourced` means a
 * published source says this, and it is quoted. `judgement` means it is an
 * informed opinion and a reader should treat it as one.
 *
 * I argued against writing these before anyone had watched a learner, on the
 * grounds that my guesses about beginners have been wrong repeatedly in this
 * project. That concern was heard and overruled, which is a reasonable call:
 * an empty lens teaches nothing either. The `confidence` field is how the
 * disagreement is resolved honestly rather than silently.
 */

import type { Source } from '../glossary/schema';

export interface Practice {
  /** What it is for. One sentence, concrete. */
  useCase: string;
  /** When you would reach for it, and the condition that makes it wrong. */
  choose: string;
  confidence: 'sourced' | 'judgement';
  source?: Source;
}

const AGENTS: Source = {
  label: 'Anthropic, Building Effective Agents',
  url: 'https://www.anthropic.com/engineering/building-effective-agents',
};
const CTX: Source = {
  label: 'Anthropic, Effective Context Engineering for AI Agents',
  url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
};
const TOOLS: Source = {
  label: 'Anthropic, Writing Tools for Agents',
  url: 'https://www.anthropic.com/engineering/writing-tools-for-agents',
};
const SCALING: Source = {
  label: 'Kaplan et al, Scaling Laws for Neural Language Models',
  url: 'https://arxiv.org/abs/2001.08361',
};
const LORA: Source = {
  label: 'Hu et al, LoRA: Low-Rank Adaptation of Large Language Models',
  url: 'https://arxiv.org/abs/2106.09685',
};
const VLLM: Source = {
  label: 'Kwon et al, Efficient Memory Management for LLM Serving with PagedAttention',
  url: 'https://arxiv.org/abs/2309.06180',
};
const MAMBA: Source = {
  label: 'Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
  url: 'https://arxiv.org/abs/2312.00752',
};
const RWKV_SRC: Source = {
  label: 'Peng et al, RWKV: Reinventing RNNs for the Transformer Era',
  url: 'https://arxiv.org/abs/2305.13048',
};

const j = (useCase: string, choose: string): Practice => ({ useCase, choose, confidence: 'judgement' });
const s = (useCase: string, choose: string, source: Source): Practice => ({
  useCase,
  choose,
  confidence: 'sourced',
  source,
});

export const PRACTICE: Record<string, Practice> = {
  beyond: j(
    'Knowing what you have learned and what you have not, before you need it.',
    'Read it once you can follow the forward pass. Do not read it first: the boundary means nothing until you know what is inside it.',
  ),
  diffusion: j(
    'Making images, video and audio, where the whole output is refined at once rather than emitted piece by piece.',
    'Reach for it for anything continuous and perceptual. Do not reach for it when the output is a short factual answer, because paying for many passes to produce a sentence is waste.',
  ),
  multimodal: j(
    'Letting one model read pictures and text together, rather than wiring two systems to each other.',
    'Choose it when the question genuinely spans both, like asking about a chart. Do not choose it for text-only work: you pay for the vision tower whether or not you send an image.',
  ),

  /* ------------------------------------------------ the whole thing ----- */
  llm: j(
    'Turning text into more text: drafting, summarising, answering, translating, writing code.',
    'Reach for one when the task is language and the answer is allowed to be approximately right. Do not reach for one when you need an exact, auditable answer, because it has no way to tell you it is guessing.',
  ),
  model: j(
    'The part you download and run. Everything else is scaffolding around it.',
    'You are choosing a model when you care about quality, cost and licence. You are rarely choosing an architecture, because for text they are all much the same shape now.',
  ),

  /* ------------------------------------------------------ foundations --- */
  foundations: j(
    'The mathematics you need to read the rest without taking anything on trust.',
    'Read this when a later explanation stops making sense. Skip it if you only want to know what a model does, not how.',
  ),
  linalg: j(
    'Describing "apply the same transformation to many things at once" compactly enough to compute.',
    'You need this the moment you want to know what a weight actually does. You do not need it to use a model.',
  ),
  vector: j(
    'Holding a meaning as a position, so that similarity becomes a measurable distance.',
    'Every time you store an embedding, search by meaning, or compare two pieces of text, this is the object you are handling.',
  ),
  matrix: j(
    'Holding a whole learned transformation in one object.',
    'You meet this whenever you look at what is inside a model file, because nearly all of it is matrices.',
  ),
  matmul: j(
    'Applying one learned transformation to many positions at once.',
    'You do not choose this. It is what the hardware is built for, and why GPUs are the hardware.',
  ),
  'dot-product': j(
    'Measuring how aligned two meanings are, which is how search-by-meaning works.',
    'Reach for it whenever you want "how similar are these two things" and you have them as vectors. Use cosine instead when length should not count.',
  ),
  calculus: j(
    'Knowing which way to nudge a number to make the answer less wrong.',
    'Only needed if you are training or debugging training. Irrelevant to anyone using a finished model.',
  ),
  derivative: j(
    'The slope that tells you which direction is downhill.',
    'Needed for training. Never needed at inference, because nothing is being adjusted.',
  ),
  backprop: j(
    'Working out how much each of billions of numbers contributed to a mistake.',
    'You rely on it whenever you train or fine-tune. You never invoke it directly; the framework does.',
  ),
  'gradient-descent': j(
    'Improving a model one small step at a time, without ever solving anything exactly.',
    'Reach for a different optimiser, not a different idea. Everything in use is a variation on this.',
  ),
  probability: j(
    'Expressing that the model is unsure, and by how much.',
    'Use the probabilities when you need a confidence signal or want to detect a guess. Ignore them when you only want the text.',
  ),
  logits: j(
    'The raw scores before they become probabilities, which is where filtering and steering happen.',
    'Work at this level when you want to ban tokens, force a format, or bias the output. Otherwise never see them.',
  ),
  softmax: j(
    'Turning arbitrary scores into a set of shares that add to one.',
    'Used automatically everywhere. You only think about it when the distribution is too sharp or too flat, which is what temperature adjusts.',
  ),
  sampling: j(
    'Deciding which token to actually emit, and therefore how creative or repetitive the output is.',
    'Lower the temperature for extraction and code. Raise it for brainstorming. If output loops, this is the first knob to reach for.',
  ),

  /* ---------------------------------------------------------- objects --- */
  objects: j(
    'The nouns you need before any explanation of the architecture will land.',
    'Read this first if the words are the obstacle rather than the ideas.',
  ),
  parameter: j(
    'The unit that model size is counted in, and what you are paying for.',
    'Parameter count is a rough proxy for capability and a precise proxy for memory. Use it to size hardware, not to predict quality.',
  ),
  tensor: j(
    'The container everything is stored and moved in.',
    'You meet tensors when debugging shapes, which is where most implementation errors live.',
  ),
  neuron: j(
    'The smallest unit that can be said to do anything on its own, and even then barely.',
    'Useful for intuition. Misleading if taken literally, because meaning is spread across many rather than living in one.',
  ),

  /* ----------------------------------------------------- architecture --- */
  architecture: j(
    'The arrangement that decides what a model can learn and how fast it trains.',
    'Almost nobody should design one. Choose an existing architecture and spend the effort on data.',
  ),
  transformer: j(
    'The design behind essentially every language model in production.',
    'The default, and the burden of proof is on anything else. Alternatives exist for very long sequences, and none has displaced it, so do not reach for one without a measured reason.',
  ),
  layer: j(
    'The unit of depth. More layers means more steps of refinement per token.',
    'Depth is a training-time decision you inherit. At inference it only matters because it sets latency and memory.',
  ),
  attention: j(
    'Letting each word pull in information from other words, which is how context changes meaning.',
    'You never choose whether to use it. You do choose variants that make it cheaper, which is what most recent work is about.',
  ),
  query: j(
    'Asking what a word is looking for.',
    'Only relevant when reading or debugging attention directly. Do not think of it as a search string; nobody wrote it and it has no words in it.',
  ),
  key: j(
    'Advertising what a word offers to be matched against.',
    'Read it when interpreting attention. Do not look for a dial here: you cannot set a key, it is produced by a learned matrix.',
  ),
  value: j(
    'Carrying the content that gets passed along when a word is attended to.',
    'Worth separating from the key when interpreting a model, because a word can be attended to strongly and still contribute little. Never something you set.',
  ),
  'attention-scores': j(
    'The raw compatibility between one word and another.',
    'Look at these when interpreting a model. They are also where the quadratic cost lives, so they matter for long context.',
  ),
  'attention-weights': j(
    'The share of attention each word actually receives.',
    'This is the picture worth showing when explaining a model, because it is the one thing a person can read directly.',
  ),
  'weighted-sum': j(
    'Actually moving the information, once the shares are decided.',
    'Never chosen. Worth knowing because it explains why attention can blend but never invent.',
  ),
  mlp: j(
    'Where most of what the model knows is stored.',
    'When people say a model "knows" something, this is usually where it lives. Most parameters are here, so most memory is too.',
  ),
  'up-projection': j(
    'Giving the model room to work in.',
    'A training-time choice you inherit, fixed at four times the width by convention rather than by proof. Do not read meaning into the number four.',
  ),
  activation: j(
    'The bend that makes depth worth having.',
    'Choices between GELU, SiLU and others change results slightly and nothing structurally. Not worth optimising unless everything else is already done.',
  ),
  'down-projection': j(
    'Bringing the wide interior back to the width of the stream.',
    'Fixed by the architecture, so never a decision you make. It matters only because it doubles the parameter cost of the widening that came before it.',
  ),
  residual: j(
    'Letting information skip past a layer that has nothing to add.',
    'Not optional in any modern network. Its absence is why very deep networks failed before 2015.',
  ),
  normalization: j(
    'Keeping numbers in a range where training does not fall apart.',
    'Inherited from the architecture. Only matters to you if you are writing the model code, where getting it wrong produces silent nonsense.',
  ),
  rope: j(
    'Encoding position in a way that survives past the length the model was trained on.',
    'Prefer it over a learned position table for anything new. It is why context windows can be extended after training.',
  ),
  embedding: j(
    'Turning text into positions so that meaning can be measured.',
    'You use this directly whenever you build search, clustering or recommendations over text.',
  ),
  tokenization: j(
    'Chopping text into units the model knows.',
    'Matters when you are counting cost, hitting a length limit, or wondering why the model cannot spell or count letters.',
  ),
  'token-id': j(
    'Addressing an entry in the vocabulary.',
    'Only relevant when working with the tokenizer directly. Never do arithmetic on one: the number is a label, so id 501 is not near id 500 in any sense.',
  ),
  unembedding: j(
    'Turning the final vector back into a score per possible next token.',
    'Where constrained decoding hooks in, if you need guaranteed JSON or a restricted vocabulary.',
  ),
  'the-loop': j(
    'Generating more than one token, which is what makes it feel like writing.',
    'Explains why output cost scales with length, why streaming is possible, and why the model has no memory between calls.',
  ),

  /* ------------------------------------------------------------ build --- */
  build: j(
    'Everything that happens before anyone can use the model.',
    'Read this if you are deciding whether to train, fine-tune, or just prompt. Most people should do the last.',
  ),
  'gather-data': j(
    'Assembling and cleaning the text a model learns from.',
    'This is where most of the quality comes from and where most of the calendar goes. Spend here before spending on model size.',
  ),
  'train-tokenizer': j(
    'Fixing the vocabulary before training starts.',
    'Only if you are training from scratch, and only if your domain is genuinely unlike normal text. Otherwise inherit one.',
  ),
  pretraining: s(
    'Creating a general model from raw text at enormous cost.',
    'Almost never the right call. The published scaling relationships let you estimate the bill before you start, and the answer is usually to fine-tune instead.',
    SCALING,
  ),
  sft: j(
    'Teaching a model to follow instructions rather than merely continue text.',
    'Reach for this when prompting cannot get the format or behaviour you need, and you can produce a few thousand good examples.',
  ),
  alignment: j(
    'Teaching behaviour that is easier to recognise than to write down.',
    'Needed when "good" is a judgement rather than a rule. Skip it if your task has a checkable right answer.',
  ),
  'lora-dora': s(
    'Specialising a model without paying to retrain it.',
    'The default fine-tuning method now. Freezing the base removes the optimiser state, so a job that needed a cluster often fits on one machine, and the result is megabytes rather than gigabytes.',
    LORA,
  ),
  evaluation: j(
    'Knowing whether a change helped, rather than believing it did.',
    'Build this before the thing you want to evaluate. Without it every later decision is taste.',
  ),
  'deploy-prep': j(
    'Turning a set of weights into something that answers requests.',
    'Quantise when memory or cost is the constraint and you can measure the quality you lose. Do not quantise blind.',
  ),
  continual: j(
    'Keeping a model current as the world moves.',
    'Prefer retrieval over retraining for facts that change. Retrain only when the behaviour itself needs to change.',
  ),

  /* ------------------------------------------------------- operations --- */
  operations: j(
    'Everything needed to run a model for real users.',
    'Read this when moving from a demo to a service, which is where most of the surprises are.',
  ),
  'training-path': j(
    'The offline half: data in, a versioned model out.',
    'Relevant if you train. If you only consume a model, you can skip the whole branch.',
  ),
  feast: j(
    'Making sure training and serving compute the same inputs the same way.',
    'Needed when features are computed rather than looked up. Overkill for a system that only sends text to a model.',
  ),
  kubeflow: j(
    'Running a training job across many machines without losing it when one dies.',
    'Needed above roughly one machine. Below that, a shell script is genuinely fine and much easier to debug.',
  ),
  mlflow: j(
    'Being able to say which data and code produced the model in production.',
    'Adopt it the first time you cannot answer that question. That moment always arrives sooner than expected.',
  ),
  'inference-path': j(
    'The online half: a request in, tokens out, fast enough to be usable.',
    'Relevant to everyone who serves a model, including people who only call an API, because it explains the bill.',
  ),
  gpu: j(
    'The hardware that makes any of this fast enough to be practical.',
    'Size by memory first, not by raw speed. Weights plus the cache for every concurrent request is what actually limits you.',
  ),
  'kv-cache': j(
    'Not recomputing the past on every generated token.',
    'You never turn it off. You do care about its size, because it is what caps how many requests you can serve at once.',
  ),
  vllm: s(
    'Serving many requests at once without wasting most of your memory.',
    'The default self-hosted serving engine. Reach for it as soon as you have more than one concurrent user, because naive serving reserves memory at maximum length and leaves most of it empty.',
    VLLM,
  ),
  aibrix: j(
    'Deciding which machine should handle which request, especially with many fine-tuned variants.',
    'Only once you have a fleet. A single server needs no control plane.',
  ),
  monitoring: j(
    'Noticing that quality has drifted before your users tell you.',
    'From day one. A model is fitted to the world as it was, and the world keeps moving.',
  ),
  'agent-layer': j(
    'Letting a model take actions rather than only describe them.',
    'Add it when the task genuinely needs the outside world. Every tool you add is also a new way to fail.',
  ),
  agentic: s(
    'Getting real work done across several steps, tools and checks.',
    'Use a workflow when you can write the steps down, and an agent only when you cannot. The published advice is to add complexity "only when it demonstrably improves outcomes", and most tasks that sound agentic are workflows.',
    AGENTS,
  ),
  'context-engineering': s(
    'Deciding what to put in front of the model each turn so it stays effective.',
    'Becomes the main lever the moment you are running loops. Models have "an attention budget", and every token you add spends it, so a full window is a choice with a cost.',
    CTX,
  ),
  mamba: s(
    'Long-context language modelling where the transformer grid becomes the serving bottleneck.',
    'Reach for it when context is long and serving cost matters. Do not reach for it when the task needs exact recall of a specific past token. A small running state is not a lookup table.',
    MAMBA,
  ),
  rwkv: s(
    'Long-context language modelling where transformer-speed training and recurrent-speed serving are both wanted.',
    'Reach for it when the serving cost per token has to stay flat. Do not reach for it when the workload leans on precise lookup of specific past tokens.',
    RWKV_SRC,
  ),
  'tool-design': s(
    'Making tools a model can actually use correctly.',
    'Consolidate around real tasks rather than exposing your API surface, because "more tools don\'t always lead to better outcomes" and each description competes for the same attention budget.',
    TOOLS,
  ),
};

/** How many entries rest on a published source rather than on judgement. */
export function sourcedCount(): number {
  return Object.values(PRACTICE).filter((p) => p.confidence === 'sourced').length;
}
