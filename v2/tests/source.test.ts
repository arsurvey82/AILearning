/**
 * The source files themselves are checked, not just what they do.
 *
 * A word-boundary escape, passed through a non-raw string on its way into this
 * repository, arrived as a literal backspace byte. The result was worse than a
 * crash: two assertions kept running, kept reporting green, and matched nothing
 * for as long as they existed. A test that silently tests nothing looks exactly
 * like a test that passes, so nothing downstream could have caught it.
 *
 * This file is therefore written in plain ASCII with no escape sequences at
 * all. It describes the characters it forbids by code point, because any escape
 * it contained would be one more thing that could be mangled on the way in, and
 * it would be mangled silently.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const LOOK = ['src', 'tests', 'tools'];
const TEXT = /\.(ts|tsx|css|md|json|html)$/;

/** Tab, newline and carriage return are legitimate. Nothing else below 32 is. */
const ALLOWED_CONTROL = new Set([9, 10, 13]);
/** En dash and em dash. Banned in everything, code and prose alike. */
const BANNED_DASH = new Set([0x2013, 0x2014]);

const isControl = (c: number) => (c < 32 && !ALLOWED_CONTROL.has(c)) || c === 127;
const isDash = (c: number) => BANNED_DASH.has(c);

/** Index of the first offending character, or -1. */
function offenceAt(s: string, bad: (code: number) => boolean): number {
  for (let i = 0; i < s.length; i++) if (bad(s.charCodeAt(i))) return i;
  return -1;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(p).isDirectory() ? files(p) : TEXT.test(name) ? [p] : [];
  });
}

/** Reads back as "src/learn/Start.tsx:106 has U+2014". */
function report(file: string, src: string, at: number): string {
  const line = src.slice(0, at).split('\n').length;
  const code = src.charCodeAt(at).toString(16).padStart(4, '0');
  return `${file.slice(ROOT.length + 1)}:${line} has U+${code}`;
}

function scan(all: string[], bad: (code: number) => boolean): string[] {
  const out: string[] = [];
  for (const f of all) {
    const src = readFileSync(f, 'utf8');
    const at = offenceAt(src, bad);
    if (at >= 0) out.push(report(f, src, at));
  }
  return out;
}

describe('the source itself', () => {
  const all = LOOK.flatMap((d) => files(join(ROOT, d)));

  it('reads at least the files it is meant to be checking', () => {
    /* A guard on the guard. If the directory walk broke, both tests below would
       pass on an empty list and report the same green as a clean repository. */
    expect(all.length).toBeGreaterThan(40);
  });

  it('contains no stray control characters', () => {
    expect(scan(all, isControl)).toEqual([]);
  });

  it('has no long dashes, which are banned in everything a reader sees', () => {
    expect(scan(all, isDash)).toEqual([]);
  });
});
