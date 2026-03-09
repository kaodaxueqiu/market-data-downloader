import { defineConfig } from 'tsup';
import { sassPlugin } from 'esbuild-sass-plugin';
import path from 'path';

export default defineConfig([
  // Main JS bundle
  {
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
      /^@tiptap\/.*/,
      '@floating-ui/react',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@openim/shared',
    ],
    esbuildOptions(options) {
      options.banner = {
        js: '"use client";',
      };
      options.alias = {
        '@': path.resolve(__dirname, 'src'),
      };
    },
    // Ignore CSS imports in JS bundle
    esbuildPlugins: [
      {
        name: 'ignore-css',
        setup(build) {
          build.onResolve({ filter: /\.(css|scss)$/ }, () => ({
            path: 'empty-css',
            namespace: 'ignore-css',
          }));
          build.onLoad({ filter: /.*/, namespace: 'ignore-css' }, () => ({
            contents: '',
            loader: 'js',
          }));
        },
      },
    ],
  },
  // CSS bundle
  {
    entry: ['src/styles/index.scss'],
    outDir: 'dist',
    minify: true,
    esbuildPlugins: [
      sassPlugin({
        type: 'css',
      }),
    ],
  },
]);
