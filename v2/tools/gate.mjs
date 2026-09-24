#!/usr/bin/env node
/**
 * The neuro-symbolic gate.
 *
 * A content sub-agent drafts. This script checks. If it fails, the agent gets
 * the failures back as JSON and revises. This is the symbolic half of the loop:
 * cheap, deterministic, unbribable by a persuasive draft.
 *
 * Rules encoded here are the ones a machine can check honestly. The rules a
 * machine cannot check (does a novice actually understand this?) still need a
 * playtest — see docs/playtest-protocol.md.
 *
 * Usage:
 *   node tools/gate.mjs path/to/file.ts [more files...]
 *   node tools/gate.mjs --staged     # check everything git has staged
 *
 * Exit 0 = pass, exit 1 = fail. Prints JSON to stdout.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/* -------------------------------------------------------------- rules --- */

const SOURCE_HOSTS = [
  /(^|\.)arxiv\.org$/i,
  /(^|\.)aclanthology\.org$/i,
  /(^|\.)aclweb\.org$/i,
  /\.edu$/i,
  /\.gov$/i,
  /(^|\.)nature\.com$/i,
  /(^|\.)science\.org$/i,
  /(^|\.)ncbi\.nlm\.nih\.gov$/i,
  /(^|\.)ieee\.org$/i,
  /(^|\.)acm\.org$/i,
  /(^|\.)jmlr\.org$/i,
  /(^|\.)nips\.cc$/i,
  /(^|\.)neurips\.cc$/i,
  /(^|\.)proceedings\.mlr\.press$/i,
  /(^|\.)openreview\.net$/i,
  /(^|\.)springer\.com$/i,
  /(^|\.)wiley\.com$/i,
  /(^|\.)jstor\.org$/i,
  /(^|\.)distill\.pub$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)huggingface\.co$/i,
  /(^|\.)pytorch\.org$/i,
  /(^|\.)tensorflow\.org$/i,
  /(^|\.)nist\.gov$/i,
];

const MARKETING = /\b(leverage|leveraged|leveraging|seamless|seamlessly|empower|empowers|empowered|unlock|unlocks|unlocking|utilize|utilizes|utilized|synergy|synergies|robust|robustly|holistic|paradigm|revolutionary|game-changing|best-in-class|world-class)\b/gi;

const FIRST_PERSON = /(?<![A-Za-z])(I|we|our|us|my|me)(?![A-Za-z])/g;

const DASHES = /[–—]/g;

/* --------------------------------------------------------- helpers ------ */

/**
 * Strip block and line comments before scanning for strings. Two failures
 * this has to survive:
 *
 * 1. An apostrophe inside a comment ("somebody's fix") would open a "string"
 *    that runs to the next apostrophe, wrapping around multiple sentences and
 *    false-firing every prose check.
 *
 * 2. A "//" inside a URL literal ("https://arxiv.org/...") would look like a
 *    line comment to a naive scanner, stripping the rest of the line and
 *    corrupting the following code so downstream checks report line numbers
 *    for content that no longer exists.
 *
 * The scanner tracks string state so a "//" inside a live string is copied
 * through, and only real comments outside any string get replaced by spaces
 * of equal length. Preserving lengths means byte offsets and line numbers
 * still line up with the original.
 */
const stripComments = (src) => {
  let out = '';
  let i = 0;
  let inString = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (inString) {
      if (c === '\\' && i + 1 < src.length) {
        out += c + next;
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      out += c;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
};

const stringsOf = (rawSrc) => {
  const src = stripComments(rawSrc);
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(src))) out.push({ text: m[2], at: m.index });
  return out;
};

const sentencesOf = (text) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z\[])/)
    .map((s) => s.trim())
    .filter(Boolean);

const wordsOf = (text) => text.split(/\s+/).filter(Boolean);

const inCommentOrCode = (src, at) => {
  const before = src.slice(Math.max(0, at - 200), at);
  return /(\/\/[^\n]*$|\/\*[^*]*$)/.test(before);
};

/* ------------------------------------------------------------- gate ----- */

function check(path) {
  const src = readFileSync(path, 'utf8');
  const failures = [];

  // Rule 3: dashes anywhere in file.
  const dashes = [...src.matchAll(DASHES)];
  for (const m of dashes) {
    failures.push({
      rule: 'no-long-dashes',
      where: `${path}:${lineAt(src, m.index)}`,
      why: `Contains ${JSON.stringify(m[0])} — banned in every file (source.test.ts).`,
      fix: 'Use "--" or a comma or rewrite the sentence.',
    });
  }

  const strs = stringsOf(src);

  // Rule 2: source URLs in string literals must be in the whitelist.
  for (const s of strs) {
    if (!/^https?:\/\//i.test(s.text)) continue;
    let host = '';
    try {
      host = new URL(s.text).hostname;
    } catch {
      failures.push({
        rule: 'unparseable-url',
        where: `${path}:${lineAt(src, s.at)}`,
        why: `URL does not parse: ${s.text}`,
      });
      continue;
    }
    if (!SOURCE_HOSTS.some((rx) => rx.test(host))) {
      failures.push({
        rule: 'source-not-whitelisted',
        where: `${path}:${lineAt(src, s.at)}`,
        why: `Host ${host} is not on the tier-1/2/3 whitelist. See docs/neuro-symbolic-gate.md.`,
        fix: 'Cite arxiv, ACL, a .edu, .gov, or a listed journal instead.',
      });
    }
  }

  // Rules 5, 7, 8: apply to prose strings only. A prose string is one that
  // contains a period followed by a space and a capital, i.e. a real sentence.
  const proseLike = strs.filter((s) => /\.\s+[A-Z]/.test(s.text) && s.text.length > 60);

  for (const s of proseLike) {
    // Rule 8: marketing verbs.
    for (const m of s.text.matchAll(MARKETING)) {
      failures.push({
        rule: 'marketing-verb',
        where: `${path}:${lineAt(src, s.at)}`,
        why: `Uses ${JSON.stringify(m[0])}. Prose voice is warm, plain, direct.`,
        fix: 'Replace with a concrete verb, or delete the clause.',
      });
    }

    // Rule 5: first-person outside comments.
    if (!inCommentOrCode(src, s.at)) {
      for (const m of s.text.matchAll(FIRST_PERSON)) {
        failures.push({
          rule: 'first-person',
          where: `${path}:${lineAt(src, s.at)}`,
          why: `Uses ${JSON.stringify(m[0])}. Voice is second person ("you"), not first.`,
          fix: 'Rewrite from the reader\'s point of view.',
        });
      }
    }

    // Rule 7: avg sentence length.
    const sents = sentencesOf(s.text);
    const avg = sents.reduce((a, x) => a + wordsOf(x).length, 0) / (sents.length || 1);
    if (avg > 22) {
      failures.push({
        rule: 'sentence-too-long',
        where: `${path}:${lineAt(src, s.at)}`,
        why: `Average sentence is ${avg.toFixed(1)} words. Cap is 22.`,
        fix: 'Split long sentences. One idea per sentence.',
      });
    }

    // Rule 9: paragraphs of >4 sentences read as walls.
    if (sents.length > 4 && !s.text.includes('\n')) {
      failures.push({
        rule: 'paragraph-too-long',
        where: `${path}:${lineAt(src, s.at)}`,
        why: `Single paragraph has ${sents.length} sentences. Cap is 4.`,
        fix: 'Break into paragraphs, or trim.',
      });
    }
  }

  return failures;
}

function lineAt(src, at) {
  return src.slice(0, at).split('\n').length;
}

/* -------------------------------------------------------------- main ---- */

function filesFromArgs(argv) {
  if (argv.includes('--staged')) {
    return execSync('git diff --staged --name-only --diff-filter=AM', { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /\.(ts|tsx|md)$/.test(s));
  }
  return argv.filter((a) => !a.startsWith('--'));
}

const files = filesFromArgs(process.argv.slice(2));
if (files.length === 0) {
  console.log(JSON.stringify({ pass: true, checked: 0, failures: [] }, null, 2));
  process.exit(0);
}

const all = [];
for (const f of files) {
  try {
    all.push(...check(f));
  } catch (e) {
    all.push({ rule: 'read-error', where: f, why: String(e) });
  }
}

const out = { pass: all.length === 0, checked: files.length, failures: all };
console.log(JSON.stringify(out, null, 2));
process.exit(all.length === 0 ? 0 : 1);
