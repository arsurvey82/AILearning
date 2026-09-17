/**
 * Does every external figure cite where it came from?
 *
 * An at-scale note says things like "4,096 dimensions" or "128k context".
 * None of those are computed by this project, so each is a claim about the
 * outside world, and a claim about the outside world without a source is the
 * thing this repository is not allowed to ship.
 */
import { NODES, basisOf, citationsFor, isConvention } from '../src/content';

const HAS_FIGURE = /[0-9]/;
const missing: string[] = [];
let cited = 0;
let noFigure = 0;
const convention: string[] = [];

for (const n of NODES) {
  for (const s of n.L3_atScale ?? []) {
    const external = [s.gpt2, s.llama].filter(Boolean).join(' ');
    if (!external) continue;
    if (!HAS_FIGURE.test(external)) { noFigure++; continue; }
    if (citationsFor(n.id, s).length > 0) cited++;
    else if (isConvention(n.id, s)) convention.push(`${n.id} :: ${s.label}`);
    else missing.push(`${n.id} :: ${s.label} :: ${external}`);
  }
}

console.log(
  `cited ${cited}  convention ${convention.length}  missing ${missing.length}  no-figure ${noFigure}`,
);
for (const c of convention) console.log('  CONVENTION ' + c + ' (' + basisOf(c.split(' :: ')[0]!, c.split(' :: ')[1]!) + ')');
for (const m of missing) console.log('  MISSING ' + m);
