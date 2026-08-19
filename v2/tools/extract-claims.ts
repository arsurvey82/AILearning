/**
 * Claim inventory, step one of validation.
 *
 * Pulls every checkable claim out of the content tree so validation works from
 * a list rather than from memory. Validating 64 nodes by reading them is how
 * you miss things; this makes the surface explicit and countable.
 *
 * Run: npx vite-node tools/extract-claims.ts > tools/claims.md
 */

import { NODES } from '../src/content';
import type { ConceptNode } from '../src/content/schema';

interface Claim {
  node: string;
  where: string;
  text: string;
}

/** Any sentence carrying a number, a unit, or a named real system. */
const NUMERIC = /\d/;
const NAMED_SYSTEM =
  /\b(GPT-2|GPT-3|Llama|nanoGPT|minGPT|vLLM|AIBrix|Feast|Kubeflow|MLflow|PagedAttention|FlashAttention|RoPE|SwiGLU|GELU|RMSNorm|LayerNorm|AdamW|Adam|SGD|LoRA|DoRA|DPO|GRPO|RLHF|BPE|MCP|GQA|MLA|Redis|DynamoDB|Bedrock|Foundry|LangGraph|ONNX|PyTorch)\b/;

function sentences(text: string): string[] {
  return text
.split(/(?<=[.!?])\s+|\n+/)
.map((s) => s.trim())
.filter(Boolean);
}

function collect(node: ConceptNode): Claim[] {
  const out: Claim[] = [];
  const add = (where: string, text: string) => {
    for (const s of sentences(text)) {
      if (NUMERIC.test(s) || NAMED_SYSTEM.test(s)) out.push({ node: node.id, where, text: s });
    }
  };

  add('L0', `${node.L0_oneLiner} ${node.L0_analogy ?? ''}`);
  node.L1?.prose.forEach((p, i) => add(`L1.prose[${i}]`, p));
  if (node.L1?.flow) {
    add('L1.flow.caption', node.L1.flow.caption);
    if (node.L1.flow.note) add('L1.flow.note', node.L1.flow.note);
    node.L1.flow.steps.forEach((s) => {
      if (s.sub) add(`L1.flow.${s.id}`, `${s.label}: ${s.sub}`);
      s.parts?.forEach((p) => {
        if (p.sub) add(`L1.flow.${s.id}.${p.id}`, `${p.label}: ${p.sub}`);
      });
    });
  }
  node.L2_snags.forEach((s, i) => add(`L2[${i}]`, s.a));

  // At-scale rows are the highest-risk surface: every cell is an assertion
  // about a real system, and they are the ones design-spec §8 singles out.
  node.L3_atScale.forEach((s) => {
    const cells = [
      ['here', s.here],
      ['gpt2', s.gpt2],
      ['llama', s.llama],
    ] as const;
    for (const [col, val] of cells) {
      if (val) out.push({ node: node.id, where: `L3.${s.label}.${col}`, text: val });
    }
    if (s.note) add(`L3.${s.label}.note`, s.note);
  });

  if (node.L4_underHood) add('L4', node.L4_underHood.replace(/```[\s\S]*?```/g, ' [code] '));
  return out;
}

const claims = NODES.flatMap(collect);

/* ---- classification heuristics (a starting point, reviewed by hand) ---- */

const DERIVABLE =
  /\b(2 ×|×|÷|=|bytes per token|per token|sum|adds up|equals|√|squared|square of|multiply|product of)\b/i;
const EXTERNAL = NAMED_SYSTEM;

function classify(c: Claim): 'derivable' | 'external' | 'judgement' {
  if (c.where.startsWith('L3.') && !c.where.endsWith('.here')) return 'external';
  if (EXTERNAL.test(c.text) && NUMERIC.test(c.text)) return 'external';
  if (DERIVABLE.test(c.text) && NUMERIC.test(c.text)) return 'derivable';
  if (EXTERNAL.test(c.text)) return 'external';
  return 'judgement';
}

const byClass = { derivable: [] as Claim[], external: [] as Claim[], judgement: [] as Claim[] };
for (const c of claims) byClass[classify(c)].push(c);

console.log('# Claim inventory\n');
console.log(`Nodes: ${NODES.length}`);
console.log(`Checkable claims: ${claims.length}`);
console.log(`- derivable (become tests): ${byClass.derivable.length}`);
console.log(`- external (need a source): ${byClass.external.length}`);
console.log(`- judgement (framing, not cited): ${byClass.judgement.length}\n`);

for (const kind of ['derivable', 'external', 'judgement'] as const) {
  console.log(`\n## ${kind} (${byClass[kind].length})\n`);
  let last = '';
  for (const c of byClass[kind]) {
    if (c.node !== last) {
      console.log(`\n### ${c.node}`);
      last = c.node;
    }
    console.log(`- \`${c.where}\`, ${c.text}`);
  }
}
