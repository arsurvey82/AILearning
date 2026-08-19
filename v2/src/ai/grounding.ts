/**
 * Builds the verified-content package the AI layer is allowed to draw on.
 *
 * This is the boundary that makes design-spec §12 work. Everything here comes
 * from authored content or the symbolic core, nothing is generated. If a fact
 * isn't in this string, the model has been told it may not assert it.
 */

import type { ConceptNode, NumberBlock } from '../content/schema';

function numbersSummary(block: NumberBlock): string {
  const lines: string[] = [
    `Worked numbers currently on screen (already computed by the lesson, quote them, never recompute):`,
    block.caption,
  ];
  // A slice is enough to ground an explanation, and keeps the request small.
  for (const g of block.groups.slice(0, 4)) {
    lines.push(`  ${g.label}${g.sublabel ? ` (${g.sublabel})` : ''}:`);
    for (const row of g.rows) {
      const shown = row.values.slice(0, 6).map((v) => v.toFixed(2)).join(', ');
      const more = row.values.length > 6 ? `, … (${row.values.length} total)` : '';
      lines.push(`    ${row.label}: [${shown}${more}]`);
    }
  }
  if (block.groups.length > 4) {
    lines.push(`  … and ${block.groups.length - 4} more token(s) not shown here.`);
  }
  if (block.footnote) lines.push(`  Note: ${block.footnote}`);
  return lines.join('\n');
}

export function buildGrounding(node: ConceptNode, block?: NumberBlock): string {
  const parts: string[] = [
    `CONCEPT: ${node.title} (${node.tag})`,
    '',
    `ONE-LINER: ${node.L0_oneLiner}`,
  ];

  if (node.L0_analogy) parts.push(`ANALOGY: ${node.L0_analogy}`);

  if (node.L1) {
    parts.push('', 'PLAIN EXPLANATION:');
    node.L1.prose.forEach((p, i) => parts.push(`  ${i + 1}. ${p.replace(/\*\*|\*|`/g, '')}`));
  }

  if (block) parts.push('', numbersSummary(block));

  if (node.L2_snags.length) {
    parts.push('', 'COMMON QUESTIONS ALREADY ANSWERED IN THIS LESSON:');
    for (const s of node.L2_snags) parts.push(`  Q: ${s.q}`, `  A: ${s.a}`, '');
  }

  if (node.L3_atScale.length) {
    parts.push('AT REAL SCALE:');
    for (const s of node.L3_atScale) {
      const cols = [
        `here ${s.here}`,
        s.gpt2 ? `GPT-2 ${s.gpt2}` : '',
        s.llama ? `Llama-3 ${s.llama}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      parts.push(`  ${s.label}: ${cols}${s.note ? ` (${s.note})` : ''}`);
    }
  }

  if (node.L4_underHood) {
    parts.push('', 'UNDER THE HOOD:', node.L4_underHood.replace(/```[a-z]*\n?/g, ''));
  }

  parts.push(
    '',
    'IMPORTANT CONTEXT: this lesson runs a deliberately tiny toy model so every number is visible.',
    'Its weights are seeded and illustrative rather than trained, so the toy does not yet perform its task correctly. The arithmetic shown is real, the starting values are not learned.',
  );

  return parts.join('\n');
}
