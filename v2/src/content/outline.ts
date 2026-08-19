/**
 * Helper for outline nodes, structure without authored depth.
 *
 * The map needs the whole territory to do its job (design-spec §5: three
 * continents; §7.2: children nest inside). Depth is what the milestones ration,
 * not shape. So every node below exists with a real one-liner and real
 * relationships, and is marked `status: 'stub'` until someone sits a beginner
 * in front of it and harvests its snags.
 *
 * The "no shells" guardrail is honoured by being loud about it: a stub says so
 * in the notebook, renders dashed on the map, and stays hollow on the progress
 * rail. What v1 did wrong was let empty boxes look full.
 */

import type { ConceptNode, NodeId, Track } from './schema';

export interface OutlineInput {
  id: NodeId;
  title: string;
  tag: string;
  color: string;
  order: number;
  track: Track;
  parent?: NodeId;
  L0_oneLiner: string;
  L0_analogy?: string;
  prereqs?: NodeId[];
  leadsTo?: NodeId[];
  related?: NodeId[];
}

export const outline = (n: OutlineInput): ConceptNode => ({
  status: 'stub',
  L2_snags: [],
  L3_atScale: [],
  prereqs: [],
  leadsTo: [],
  related: [],
  ...n,
});
