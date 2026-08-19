import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Two docs disagreed on the stack:
 *   CLAUDE.md §3          -> Vite + React + TypeScript (needed for the §10 test gates)
 *   design-spec §8        -> "one self-contained HTML file ... no build step"
 *
 * viteSingleFile reconciles them: we develop in typed, tested modules and SHIP
 * exactly one .html with every script, style and asset inlined. The artifact
 * opens over file:// with zero dependencies, which is what §8 actually wanted.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Relative base so the built file works from file:// and from any subpath
  // on GitHub Pages (/AILearning/v2/).
  base: './',
  build: {
    outDir: 'dist',
    // Inline everything; no separate chunks for singlefile to stitch.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    target: 'es2020',
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
