/**
 * Structural tests for the content tree.
 *
 * With ~50 nodes authored by hand, a mistyped `leadsTo` silently produces the
 * dead end §7.3 exists to prevent, and an orphaned `parent` silently drops a
 * whole branch off the map. Neither is visible by looking at the screen, so
 * both are asserted here.
 */

import { describe, expect, it } from 'vitest';
import {
  FORWARD_PASS,
  NODES,
  NODES_BY_ID,
  ROOT_ID,
  childrenOf,
  descendantCount,
  findBrokenLinks,
  forwardPassBuiltCount,
  pathTo,
  siblingsOf,
  walkStep,
  ORIGINS,
  nodeTimeline,
  forcedNodes,
  ASPECTS,
  byPhase,
  leavesNoTrace,
  PRACTICE,
  sourcedCount,
} from '../src/content';

describe('referential integrity', () => {
  it('has no broken parent, prereq, leadsTo or related links', () => {
    expect(findBrokenLinks()).toEqual([]);
  });

  it('has unique ids', () => {
    expect(Object.keys(NODES_BY_ID)).toHaveLength(NODES.length);
  });

  it('reaches every node from the root by containment, no orphans', () => {
    expect(descendantCount(ROOT_ID) + 1).toBe(NODES.length);
  });

  it('has exactly one root', () => {
    expect(NODES.filter((n) => !n.parent).map((n) => n.id)).toEqual([ROOT_ID]);
  });

  it('has no containment cycles', () => {
    for (const n of NODES) {
      const path = pathTo(n.id);
      expect(path[0]?.id).toBe(ROOT_ID);
      expect(new Set(path.map((p) => p.id)).size).toBe(path.length);
    }
  });
});

describe('the three continents', () => {
  it('splits the universe into Model, Build and Operations', () => {
    expect(childrenOf(ROOT_ID).map((n) => n.id)).toEqual(['model', 'build', 'operations']);
  });

  it('puts Operations on a training path and an inference path', () => {
    expect(childrenOf('operations').map((n) => n.id)).toEqual(['training-path', 'inference-path']);
  });

  it('has Feast, Kubeflow and MLflow on the training path', () => {
    expect(childrenOf('training-path').map((n) => n.id)).toEqual(['feast', 'kubeflow', 'mlflow']);
  });

  it('has the serving stack on the inference path', () => {
    expect(childrenOf('inference-path').map((n) => n.id)).toEqual([
      'gpu',
      'kv-cache',
      'vllm',
      'aibrix',
      'agent-layer',
      'agentic',
      'context-engineering',
      'tool-design',
      'monitoring',
    ]);
  });

  it('nests the transformer internals inside the repeated layer', () => {
    expect(childrenOf('layer').map((n) => n.id)).toContain('attention');
    expect(childrenOf('attention').map((n) => n.id)).toEqual([
      'query',
      'key',
      'value',
      'attention-scores',
      'attention-weights',
      'weighted-sum',
    ]);
  });

  it('puts Embedding inside the transformer, between Token ID and the layer', () => {
    const sibs = siblingsOf('embedding').map((n) => n.id);
    expect(sibs).toEqual(['tokenization', 'token-id', 'embedding', 'layer', 'unembedding', 'the-loop']);
  });
});

describe('the forward-pass spine', () => {
  it('is a contiguous walkable stretch, not scattered nodes', () => {
    // The first four steps are complete, so a learner can walk raw letters all
    // the way to attention percentages on one input without hitting an outline.
    expect(FORWARD_PASS.slice(0, 4)).toEqual([
      'tokenization',
      'token-id',
      'embedding',
      'attention',
    ]);
    // The whole pipeline is now walkable without hitting an outline.
    expect(forwardPassBuiltCount()).toBe(FORWARD_PASS.length);
  });

  it('every step resolves to a real node', () => {
    for (const id of FORWARD_PASS) expect(NODES_BY_ID[id], id).toBeTruthy();
  });

  it('walks forward across containment boundaries', () => {
    // The bug this prevents: Embedding sits in The Transformer, Attention sits
    // two levels deeper inside a Layer. Walking siblings from Embedding goes to
    // the repeated Layer, not into Attention, sideways, not forward.
    expect(walkStep('embedding', 1)?.id).toBe('attention');
    expect(walkStep('attention', -1)?.id).toBe('embedding');
    expect(NODES_BY_ID['embedding']?.parent).toBe('transformer');
    expect(NODES_BY_ID['attention']?.parent).toBe('layer');
  });

  it('has no step before the first or after the last', () => {
    expect(walkStep('tokenization', -1)).toBeUndefined();
    expect(walkStep(FORWARD_PASS[FORWARD_PASS.length - 1]!, 1)).toBeUndefined();
  });

  it('each built step declares the next one as what it unlocks', () => {
    for (let i = 0; i < forwardPassBuiltCount() - 1; i++) {
      const here = NODES_BY_ID[FORWARD_PASS[i]!];
      expect(here?.leadsTo, here?.id).toContain(FORWARD_PASS[i + 1]);
    }
  });
});

describe('honesty about depth', () => {
  it('completes the whole forward-pass stretch and the whole Operations continent', () => {
    const complete = new Set(NODES.filter((n) => n.status === 'complete').map((n) => n.id));
    for (const id of ['tokenization', 'token-id', 'embedding', 'attention']) {
      expect(complete.has(id), id).toBe(true);
    }
    // Operations was the continent where a one-liner was most useless: these
    // are systems with parts, and parts need a diagram.
    for (const id of [
      'operations',
      'training-path',
      'feast',
      'kubeflow',
      'mlflow',
      'inference-path',
      'gpu',
      'kv-cache',
      'vllm',
      'aibrix',
      'agent-layer',
      'agentic',
      'context-engineering',
      'tool-design',
      'monitoring',
    ]) {
      expect(complete.has(id), id).toBe(true);
    }
  });

  it('leaves no node as a bare one-liner', () => {
    const stubs = NODES.filter((n) => n.status !== 'complete');
    expect(stubs.map((n) => n.id)).toEqual([]);
  });

  it('only claims "real beginners asked this" where snags were actually harvested', () => {
    // Exactly one node has been playtested. Marking others the same way would
    // spend authority the content has not earned.
    const playtested = NODES.filter((n) => n.snagsPlaytested).map((n) => n.id);
    expect(playtested).toEqual(['embedding']);
  });

  it('gives every complete node either real numbers or a real diagram', () => {
    // A "complete" node with neither is the empty box this whole pass exists
    // to remove.
    for (const n of NODES.filter((x) => x.status === 'complete')) {
      const hasSubstance = Boolean(n.L1?.example) || Boolean(n.L1?.flow);
      expect(hasSubstance, `${n.id} has no worked example and no flow diagram`).toBe(true);
      // Nodes ON the pipeline carry more, because a learner arrives at them by
      // walking rather than by looking something up. Foundations and Core
      // Objects are reference material and two solid cards is enough there, 
      // padding them out with filler would be the shell problem again.
      expect(n.L2_snags.length, n.id).toBeGreaterThanOrEqual(
        FORWARD_PASS.includes(n.id) ? 3 : 2,
      );
      expect(n.L4_underHood, n.id).toBeTruthy();
    }
  });

  it('every flow diagram step is labelled and typed', () => {
    for (const n of NODES) {
      for (const step of n.L1?.flow?.steps ?? []) {
        expect(step.label.length, `${n.id}/${step.id}`).toBeGreaterThan(0);
        for (const part of step.parts ?? []) {
          expect(part.label.length, `${n.id}/${step.id}/${part.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('the agent layer names its components, because that is the whole concept', () => {
    // "An agent is a model plus tools plus memory in a loop" is the lesson; a
    // one-line description of a structure teaches nothing.
    const agent = NODES_BY_ID['agent-layer'];
    const parts = (agent?.L1?.flow?.steps ?? []).flatMap((s) => s.parts ?? []).map((p) => p.label);
    expect(parts).toEqual(expect.arrayContaining(['Model', 'Tools', 'MCP servers', 'Memory']));
    expect(agent?.L1?.flow?.loop).toMatch(/tool call/i);
  });

  it('wires every worked example to the symbolic core rather than to literals', () => {
    // Not every complete node has numbers, there is nothing to compute about
    // AIBrix. But any node that claims a worked example must compute it.
    for (const n of NODES.filter((x) => x.L1?.example)) {
      expect(n.L1?.example?.compute, n.id).toBeTypeOf('function');
    }
    for (const n of NODES.filter((x) => x.status === 'complete')) {
      expect(n.L3_atScale.length, n.id).toBeGreaterThan(0);
    }
  });

  it('gives every node a real one-liner. structure is never an empty box', () => {
    for (const n of NODES) {
      expect(n.L0_oneLiner.length).toBeGreaterThan(20);
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.tag.length).toBeGreaterThan(0);
    }
  });

  it('does not present an LLM as a machine', () => {
    // The v1 prototype tagged the root "the machine". Snag 8 corrects exactly
    // that, so the root must not assert it, the current tag negates it
    // instead, which is why this checks the claim rather than the word.
    const root = NODES_BY_ID[ROOT_ID];
    expect(root?.tag).not.toBe('the machine');
    expect(root?.tag).toMatch(/model/i);
    expect(root?.L0_oneLiner).toMatch(/function/i);
  });
});

describe('origins: why each concept exists', () => {
  /**
   * The axis the map lacked entirely.
   *
   * Explaining what normalisation does never answers "why is there
   * normalisation at all"; naming the failure that made it necessary does. So
   * every origin has to point at a real earlier problem, and the dates have to
   * keep separating things a newcomer fuses into one recent invention.
   */
  it('attaches only to nodes that exist', () => {
    const unknown = Object.keys(ORIGINS).filter((id) => !NODES_BY_ID[id]);
    expect(unknown, `origins for missing nodes: ${unknown.join(', ')}`).toEqual([]);
  });

  it('names a real earlier failure, not a benefit restated', () => {
    for (const { id, origin } of nodeTimeline()) {
      const o = origin as { problem: string; gained: string };
      expect(o.problem.length, `${id} has no named problem`).toBeGreaterThan(40);
      expect(o.gained.length, `${id} does not say what it bought`).toBeGreaterThan(20);
      // A problem that just praises the fix is not a problem.
      expect(o.problem.toLowerCase(), id).not.toContain('allows');
    }
  });

  it('cites every dated claim', () => {
    const uncited = nodeTimeline()
      .filter(({ origin }) => !(origin as { source?: unknown }).source)
      .map((x) => x.id);
    expect(uncited, `dated but uncited: ${uncited.join(', ')}`).toEqual([]);
  });

  it('separates what was forced from what somebody chose', () => {
    expect(forcedNodes().length).toBeGreaterThan(2);
    for (const id of forcedNodes()) {
      expect(ORIGINS[id], id).not.toHaveProperty('year');
      expect((ORIGINS[id] as { because: string }).because.length).toBeGreaterThan(40);
    }
  });

  /**
   * The separation is the whole point of carrying dates. If these ever stop
   * being ordered, the structure has quietly lost its reason to exist.
   */
  it('keeps the fused concepts apart in time', () => {
    const y = (id: string) => (ORIGINS[id] as { year: number }).year;
    expect(y('neuron'), 'the neuron predates everything').toBeLessThan(y('backprop'));
    expect(y('backprop'), 'backprop is not a transformer idea').toBeLessThan(y('attention'));
    expect(y('attention'), 'attention is not the transformer').toBeLessThan(y('transformer'));
    expect(y('residual'), 'residuals came from vision, before the transformer').toBeLessThan(
      y('transformer'),
    );
    expect(y('pretraining')).toBeGreaterThan(y('transformer'));
  });

  it('spans decades, so the stack of fixes is visible', () => {
    const years = nodeTimeline().map((t) => t.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(Math.max(...years) - Math.min(...years), 'all clustered in one era').toBeGreaterThan(50);
  });

  it('does not invent a history for things that are just objects', () => {
    /* The line is objects versus operations, and an earlier version of this
       test put it in the wrong place.

       A vector is a thing. Nobody chose for lists of numbers to exist, and
       there is no failure they repaired, so claiming a history for one would be
       worse than saying nothing. A dot product is an operation, and "why is
       comparison done that way" has a real answer: it is what comparing two
       positions means. So that one earns a forced origin and these do not. */
    for (const id of ['vector', 'matrix', 'tensor']) {
      /* These used to be absent from ORIGINS entirely. Absence was silence,
         and silence reads the same as an oversight. They now answer "there is
         nothing to chase here, and this is why", which is a real answer. */
      expect(ORIGINS[id]?.kind, `${id} is an object`).toBe('none');
    }
    expect(ORIGINS['dot-product']?.kind, 'an operation can be forced').toBe('forced');
  });
});

describe('aspects: when it runs, and what of it ships', () => {
  /**
   * The axis that kills the biggest misconception about these systems.
   *
   * People assume a model file contains the machinery that produced it. It does
   * not: no loss, no gradients, no optimiser. So `trace: null` is a real answer
   * here rather than missing data, and these tests protect it from being
   * "helpfully" filled in later.
   */
  it('attaches only to nodes that exist', () => {
    const unknown = Object.keys(ASPECTS).filter((id) => !NODES_BY_ID[id]);
    expect(unknown, `aspects for missing nodes: ${unknown.join(', ')}`).toEqual([]);
  });

  it('says plainly that the training machinery is not in the file', () => {
    // If any of these ever gains a trace, something has gone wrong in the
    // writing, because none of them survives into a checkpoint.
    for (const id of ['backprop', 'gradient-descent', 'derivative']) {
      expect(ASPECTS[id]?.trace, `${id} should leave no trace`).toBeNull();
      expect(ASPECTS[id]?.phase, id).toBe('training');
    }
  });

  it('says the attention scores everyone pictures are never stored', () => {
    expect(ASPECTS['attention-scores']?.trace).toBeNull();
    expect(ASPECTS['attention-weights']?.trace).toBeNull();
    // But the weights that produce them are the file.
    expect(ASPECTS['attention']?.trace).toBeTruthy();
    expect(ASPECTS['parameter']?.trace).toBeTruthy();
  });

  it('separates things that only exist while answering', () => {
    for (const id of ['kv-cache', 'the-loop', 'agent-layer']) {
      expect(ASPECTS[id]?.phase, id).toBe('inference');
    }
    // The KV cache is a serving structure and was never part of training.
    expect(ASPECTS['kv-cache']?.trace).toBeNull();
  });

  it('keeps a real answer for every entry, including the empty one', () => {
    for (const [id, a] of Object.entries(ASPECTS)) {
      expect(['setup', 'training', 'inference', 'both'], id).toContain(a.phase);
      // trace may be null, but it may not be an empty or lazy string.
      if (a.trace !== null) expect(a.trace.length, id).toBeGreaterThan(15);
      if (a.code) expect(a.code.length, id).toBeGreaterThan(3);
    }
  });

  it('covers all four phases, so the split is doing work', () => {
    const p = byPhase();
    expect(p.training.length).toBeGreaterThan(5);
    expect(p.inference.length).toBeGreaterThan(5);
    expect(p.both.length).toBeGreaterThan(10);
    expect(p.setup.length).toBeGreaterThan(0);
  });

  it('finds plenty that leaves nothing behind, which is the point', () => {
    expect(leavesNoTrace().length, 'nothing is absent from the file?').toBeGreaterThan(10);
  });
});

describe('every lens answers every concept', () => {
  /**
   * 100% means every concept has an ANSWER, not that every concept has a
   * history. A vector is an object, so its origin says "there is nothing to
   * chase here" rather than inventing a date. An explicit no is an answer; a
   * blank cell is not.
   */
  it('covers all 67 concepts on every factual lens', () => {
    for (const n of NODES) {
      expect(ORIGINS[n.id], `${n.id} has no origin`).toBeDefined();
      expect(ASPECTS[n.id], `${n.id} has no aspect`).toBeDefined();
      expect(ASPECTS[n.id]?.code, `${n.id} has no code`).toBeTruthy();
      expect(PRACTICE[n.id], `${n.id} has no practice`).toBeDefined();
    }
  });

  it('answers "no history" explicitly rather than inventing one', () => {
    const none = Object.entries(ORIGINS).filter(([, o]) => o.kind === 'none');
    expect(none.length, 'nothing is an object?').toBeGreaterThan(10);
    for (const [id, o] of none) {
      expect((o as { because: string }).because.length, id).toBeGreaterThan(40);
    }
    // The objects specifically must be in that group, not given a date.
    for (const id of ['vector', 'matrix', 'tensor', 'layer']) {
      expect(ORIGINS[id]?.kind, id).toBe('none');
    }
  });

  it('marks the two opinion lenses as opinion', () => {
    for (const [id, p] of Object.entries(PRACTICE)) {
      expect(['sourced', 'judgement'], id).toContain(p.confidence);
      expect(p.useCase.length, id).toBeGreaterThan(25);
      expect(p.choose.length, id).toBeGreaterThan(40);
      // A sourced claim must carry the source it claims.
      if (p.confidence === 'sourced') expect(p.source, id).toBeDefined();
    }
  });

  it('grounds what it can, and does not overclaim the rest', () => {
    // Six entries rest on a published source. The rest are informed opinion
    // and say so, which is the honest split rather than a flattering one.
    expect(sourcedCount()).toBeGreaterThanOrEqual(5);
    expect(sourcedCount()).toBeLessThan(Object.keys(PRACTICE).length / 2);
  });

  it('says when NOT to use something, not only when to use it', () => {
    /* A "when to choose" lens that only ever recommends is marketing. Most
       entries should name a condition under which the answer is no. */
    const negative = Object.values(PRACTICE).filter((p) =>
      /\b(do not|never|rarely|skip|overkill|not the right|almost never|instead)\b/i.test(p.choose),
    );
    expect(negative.length / Object.keys(PRACTICE).length).toBeGreaterThan(0.3);
  });
});
