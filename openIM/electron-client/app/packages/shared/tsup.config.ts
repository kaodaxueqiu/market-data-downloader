import { defineConfig } from 'tsup';
import path from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  minify: true,
  external: [
    'react',
    'react-dom',
    'clsx',
    'tailwind-merge',
    'lodash.throttle',
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
    options.alias = {
      '@': path.resolve(__dirname, 'src'),
    };
  },
});
