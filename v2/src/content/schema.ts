/**
 * The content schema. CLAUDE.md §5, "the anti-shell contract".
 *
 * All teaching content is DATA. A node is authored once here and rendered by a
 * generic component. Nothing in /src/engine knows what a token or a seat is.
 *
 * The hard rule: WorkedExample.compute must call the symbolic core, so every
 * number on screen changes when the Run control changes. Content files must not
 * contain literal vector values.
 */

import type { EmbedResult } from '../model/embedding';

export type NodeId = string;

export type Track = 'model' | 'build' | 'operations';

/** The three roles a row of numbers can play, coloured distinctly and always labelled. */
export type NumberRole = 'token' | 'position' | 'input' | 'neutral';

export interface NumberRow {
  /** e.g. `token "B"` */
  label: string;
  role: NumberRole;
  values: number[];
  /**
   * Provenance for the hover probe (CLAUDE.md §7.4): given a dimension index,
   * say where that exact number came from.
   */
  sourceOf: (dim: number) => string;
}

/** One token's worth of rows. Shown one group at a time to keep the surface calm. */
export interface NumberGroup {
  id: string;
  /** e.g. `B @ seat 3` */
  label: string;
  sublabel?: string;
  rows: NumberRow[];
}

export interface NumberBlock {
  caption: string;
  /** Full width of the rows, even though only a slice is rendered. */
  totalDims: number;
  groups: NumberGroup[];
  footnote?: string;
  /**
   * What a column counts. Vectors are indexed by dimension; an attention row is
   * indexed by the token being looked at. Saying "6 of 6 dimensions" over an
   * attention matrix would be quietly wrong.
   */
  unit?: string;
}

export interface WorkedExample {
  caption: string;
  /** MUST pull from /src/model. Never static. */
  compute: (input: string) => NumberBlock;
}

/* ------------------------------------------------------------------ *
 * Flow diagrams
 *
 * The thing bbycroft does that a bullet list cannot: show what is INSIDE
 * a stage and which way the data moves through it. "Agent layer" as a
 * sentence is nearly useless; as a box containing model + tools + memory
 * with a loop arrow, it explains itself.
 *
 * Deliberately HTML/CSS rather than SVG: real text reflows on a phone, is
 * selectable, and is readable by a screen reader without a parallel
 * description. A hand-laid-out SVG is none of those things.
 * ------------------------------------------------------------------ */

export type FlowKind =
  | 'input' // something entering from outside
  | 'stage' // a step that transforms
  | 'store' // something that holds state
  | 'control' // something that decides or routes
  | 'output'; // what leaves

export interface FlowNode {
  id: string;
  label: string;
  /** One short clause. Not a sentence. */
  sub?: string;
  kind?: FlowKind;
  /** What lives inside this box. This is the part a one-liner can never carry. */
  parts?: FlowNode[];
}

export interface FlowSpec {
  caption: string;
  steps: FlowNode[];
  /** Label for a feedback arrow drawn back to the start. */
  loop?: string;
  /** One line under the diagram for the thing the boxes can't show. */
  note?: string;
}

/** A playtested wrong turn. `q` is phrased as the learner would ask it. */
export interface Snag {
  q: string;
  a: string;
}

/* ------------------------------------------------------------------ *
 * Checkpoints, retrieval practice
 *
 * Roediger & Karpicke: "Testing is a powerful means of improving learning,
 * not just assessing it." Retrieval produces substantially better long-term
 * retention than re-reading, alternating study and test is stronger than
 * either alone, and feedback strengthens the effect further.
 *
 * Two design consequences that are not decoration:
 *
 * - Every wrong option is a REAL misconception, taken from that node's snag
 *   cards. A distractor nobody would pick tests recognition of wording, not
 *   recall of the idea.
 * - Choosing a wrong option routes you to the snag that already answers it.
 *   That is the feedback the research says matters, and it costs no new
 *   content. The answer was already written and, for Embedding, playtested.
 * ------------------------------------------------------------------ */

export interface CheckpointOption {
  text: string;
  correct?: boolean;
  /** Shown after answering. Explains, never just marks. */
  feedback: string;
  /** The snag card that already addresses this misconception, if any. */
  snagQ?: string;
}

export interface Checkpoint {
  /** Phrased to require recall, not recognition of a sentence just read. */
  question: string;
  options: CheckpointOption[];
}

/** Where a figure can be checked. Shared so a citation is one object. */
export interface Source {
  label: string;
  url: string;
}

export interface ScaleNote {
  label: string;
  here: string;
  gpt2?: string;
  llama?: string;
  note?: string;
  /**
   * Where an external figure came from. Design-spec §8 requires that "all
   * at-scale figures get a verification pass", this is that pass, made
   * durable. An uncited figure is one nobody has checked, and the UI says so
   * rather than letting it pass as verified.
   *
   * Omit for `here` values, which are computed from the toy model itself and
   * are checked by tests rather than by citation.
   */
  source?: Source;
}

/**
 * `complete` = has a real worked example AND populated snags (the "no shells"
 * guardrail, CLAUDE.md §2). `stub` nodes exist so the map has shape and the
 * Needs/Unlocks links never dead-end, and they say plainly that they are stubs
 * rather than pretending to be content.
 */
export type NodeStatus = 'complete' | 'stub';

/**
 * Where a concept came from.
 *
 * The axis the map never had, and the one that stops a knob feeling arbitrary.
 * Explaining what normalisation does never answers "why is there normalisation";
 * naming the failure that made it necessary does.
 *
 * Two kinds, and the split matters more than either alone:
 *
 *   forced   nobody chose it. It falls out of the problem, and there is no
 *            alternative history in which it is different.
 *   fix      somebody's contingent solution, with a year and a named earlier
 *            failure. It could have gone another way, and sometimes did.
 *
 * The dates do real work: they pry apart things a newcomer fuses into one
 * recent invention. Attention is 2014 and the transformer is 2017, so attention
 * is not the transformer. Backpropagation predates both and belongs to any
 * neural network. Shared with the glossary deliberately, so a term and a node
 * describing the same history cannot drift apart.
 */
export type { Origin } from '../glossary/schema';

/**
 * When a concept is live, and whether any of it survives into the file you download.
 *
 * The axis that kills the largest single misconception about these systems.
 * People assume a model file contains the machinery that made it: the loss
 * function, the gradients, the optimiser. None of that is in there. What ships
 * is a pile of numbers and a little configuration, and everything that did the
 * learning was scaffolding that was thrown away.
 *
 * So every concept answers two questions a reader can check against a real
 * download:
 *
 *   phase   when is this thing running at all
 *   trace   what of it exists in the shipped artifact, or null for nothing
 *
 * `trace: null` is the interesting value, not a gap in the data. Loss, gradient
 * and backpropagation all legitimately have nothing to point at, and saying so
 * teaches more than any description of them would.
 */
export type Phase =
  /** Before anything runs: shapes decided, tables created, nothing meaningful yet. */
  | 'setup'
  /** Only while learning. Gone by the time anyone uses the model. */
  | 'training'
  /** Only while answering. Did not exist while the model was being trained. */
  | 'inference'
  /** Both, and usually the same code path. */
  | 'both';

export interface Aspect {
  phase: Phase;
  /**
   * What of this you would find inside the downloaded model, in plain words.
   * null means nothing at all, which is often the point.
   */
  trace: string | null;
  /** The code that actually realises it, named concretely. */
  code?: string;
}

export interface ConceptNode {
  id: NodeId;
  title: string;
  tag: string;
  track: Track;
  order: number;
  /** A design token name from tokens.css, e.g. 'blue'. Never a raw hex. */
  color: string;
  status: NodeStatus;

  /**
   * Containment, which is a different relationship from prereqs/leadsTo.
   * `parent` is "lives inside". Attention is inside a Transformer Layer, which
   * is inside The Transformer. This is what the map's semantic zoom walks
   * (design-spec §7.2, "child concepts nest inside / box in box"), and what the
   * v1 prototype's nested cosmos encoded. Prereqs and leadsTo are ORDER, not
   * containment: Attention needs Embedding first but does not sit inside it.
   */
  parent?: NodeId;

  L0_oneLiner: string;
  /**
   * Optional on purpose. A good analogy is earned by watching someone fail to
   * understand the plain version. Inventing fifty of them to fill a field
   * would be exactly the shell-content the spec warns about.
   */
  L0_analogy?: string;

  /**
   * `example` is optional because most concepts have no number to compute , 
   * AIBrix has no arithmetic to show. `flow` carries the structure instead.
   * A node with neither is genuinely empty and should not claim otherwise.
   */
  /**
   * A named purpose-built visual, rendered by the engine.
   *
   * Deliberately a small closed set rather than arbitrary content. A general
   * animation framework would let any node animate anything; almost all of
   * that would be decoration, and decoration costs the learner attention it
   * needs for the material (Mayer's coherence principle).
   */
  L1?: {
    prose: string[];
    example?: WorkedExample;
    flow?: FlowSpec;
    visual?: 'attention-arcs';
  };

  /**
   * Why this exists at all. Optional because not everything has an origin
   * worth claiming: a vector is an object, not somebody's fix for something.
   * Inventing a history for it would be worse than leaving it empty.
   */
  origin?: import('../glossary/schema').Origin;

  /**
   * When it runs, and whether it survives into the shipped file. Optional
   * because a container node like "The Model" has no single honest answer.
   */
  aspect?: Aspect;

  L2_snags: Snag[];
  /**
   * Whether L2 came from watching a real beginner trip, or from anticipating
   * where they will. Both are useful; conflating them is not. Only playtested
   * cards get to claim "questions real beginners asked here", the rest say
   * plainly that they are anticipated, so the field-tested ones keep their
   * authority.
   */
  snagsPlaytested?: boolean;
  L3_atScale: ScaleNote[];
  L4_underHood?: string;

  /** Retrieval practice for this node. Never a gate, always skippable. */
  checkpoint?: Checkpoint;

  /** Highlighted blue on the map: what you need first. */
  prereqs: NodeId[];
  /** Highlighted green on the map: what this unlocks. */
  leadsTo: NodeId[];
  related: NodeId[];
}

/** Convenience for content authors building a NumberBlock out of an EmbedResult. */
export type BlockBuilder = (result: EmbedResult) => NumberBlock;
