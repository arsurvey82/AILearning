/**
 * The node registry. Single source of truth for what exists and how it links.
 *
 * Two independent relationships live here and must not be confused:
 *   CONTAINMENT (parent/children)  -> what the map's semantic zoom walks
 *   ORDER       (prereqs/leadsTo)  -> what the blue/green rims and the
 *                                     Needs/Unlocks footer express
 * Attention is INSIDE a Transformer Layer, but comes AFTER Embedding.
 */

import { agenticNodes } from './nodes/agentic';
import { attentionNode } from './nodes/attention';
import { embeddingNode } from './nodes/embedding';
import { buildNodes } from './nodes/build';
import { modelNodes, rootNode } from './nodes/model';
import { operationsNodes } from './nodes/operations';
import { tokenIdNode } from './nodes/tokenId';
import { tokenizationNode } from './nodes/tokenization';
import { transformerNodes } from './nodes/transformer';
import type { ConceptNode, NodeId } from './schema';

export { ORIGINS, nodeTimeline, forcedNodes } from './origins';

export const ROOT_ID: NodeId = 'llm';

export const NODES: ConceptNode[] = [
  rootNode,
  ...modelNodes,
  ...transformerNodes,
  tokenizationNode,
  tokenIdNode,
  embeddingNode,
  attentionNode,
  ...buildNodes,
  ...operationsNodes,
  ...agenticNodes,
];

/**
 * THE SPINE. The forward pass, in the order a learner should walk it.
 *
 * This is ORDER, and it deliberately cuts across CONTAINMENT: Attention lives
 * inside a Transformer Layer, two levels below Embedding, but comes straight
 * after it in the pipeline. Prev/Next follows this list rather than siblings,
 * because a learner walking the pipeline should never be stopped by a box
 * boundary. That was a real dead end in the first build.
 *
 * Nodes still under construction stay in the list: the walk shows honestly
 * where the built ground ends.
 */
export const FORWARD_PASS: readonly NodeId[] = [
  'tokenization',
  'token-id',
  'embedding',
  'attention',
  'mlp',
  'residual',
  'normalization',
  'unembedding',
  'logits',
  'softmax',
  'sampling',
  'the-loop',
];

/** Where the walk stops being fully authored, used to set expectations up front. */
export function forwardPassBuiltCount(): number {
  let n = 0;
  for (const id of FORWARD_PASS) {
    if (NODES_BY_ID[id]?.status !== 'complete') break;
    n++;
  }
  return n;
}

/** The node before/after this one along the pipeline, or undefined at the ends. */
export function walkStep(id: NodeId, dir: -1 | 1): ConceptNode | undefined {
  const i = FORWARD_PASS.indexOf(id);
  if (i === -1) return undefined;
  const next = FORWARD_PASS[i + dir];
  return next ? getNode(next) : undefined;
}

export function isOnForwardPass(id: NodeId): boolean {
  return FORWARD_PASS.includes(id);
}

export const NODES_BY_ID: Readonly<Record<NodeId, ConceptNode>> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
);

export function getNode(id: NodeId): ConceptNode | undefined {
  return NODES_BY_ID[id];
}

const CHILDREN: Record<NodeId, ConceptNode[]> = {};
for (const n of NODES) {
  if (!n.parent) continue;
  (CHILDREN[n.parent] ??= []).push(n);
}
for (const list of Object.values(CHILDREN)) list.sort((a, b) => a.order - b.order);

/** Direct children, in their authored order. */
export function childrenOf(id: NodeId): ConceptNode[] {
  return CHILDREN[id] ?? [];
}

export function hasChildren(id: NodeId): boolean {
  return (CHILDREN[id]?.length ?? 0) > 0;
}

/** Root down to the node itself, the breadcrumb. */
export function pathTo(id: NodeId): ConceptNode[] {
  const out: ConceptNode[] = [];
  let cur = getNode(id);
  const guard = new Set<NodeId>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    out.unshift(cur);
    cur = cur.parent ? getNode(cur.parent) : undefined;
  }
  return out;
}

/**
 * The node's siblings. What Prev/Next walks and what the progress rail counts.
 * With ~50 nodes across three continents, "4 of 50" would be meaningless;
 * "3 of 6 inside The Transformer" is the number a learner can actually use.
 */
export function siblingsOf(id: NodeId): ConceptNode[] {
  const n = getNode(id);
  if (!n) return [];
  if (!n.parent) return [n];
  return childrenOf(n.parent);
}

export function descendantCount(id: NodeId): number {
  return childrenOf(id).reduce((sum, c) => sum + 1 + descendantCount(c.id), 0);
}

/**
 * Referential integrity. Every parent, prereq, leadsTo and related id must
 * resolve, or the map draws a relationship to nothing and the notebook offers a
 * chip that goes nowhere. The dead end §7.3 exists to prevent.
 */
export function findBrokenLinks(): string[] {
  const problems: string[] = [];
  for (const n of NODES) {
    const check = (ids: NodeId[], field: string) => {
      for (const id of ids) {
        if (!NODES_BY_ID[id]) problems.push(`${n.id}.${field} -> "${id}" does not exist`);
      }
    };
    if (n.parent && !NODES_BY_ID[n.parent]) {
      problems.push(`${n.id}.parent -> "${n.parent}" does not exist`);
    }
    check(n.prereqs, 'prereqs');
    check(n.leadsTo, 'leadsTo');
    check(n.related, 'related');
  }
  return problems;
}

/** The node the app opens on: the whole universe, for orientation. */
export const ENTRY_NODE_ID: NodeId = ROOT_ID;

export type { ConceptNode, NodeId } from './schema';
