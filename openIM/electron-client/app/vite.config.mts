import { rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-electron-plugin";
import { customStart, loadViteEnv } from "vite-electron-plugin/plugin";
import legacy from "@vitejs/plugin-legacy";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  rmSync("dist-electron", { recursive: true, force: true });

  const sourcemap = command === "serve" || !!process.env.VSCODE_DEBUG;

  // 从 version.json 读取版本号
  const versionJson = JSON.parse(readFileSync("./version.json", "utf-8"));
  const isProd = mode === "production";
  const appVersion = isProd ? `v${versionJson.prod}` : `v${versionJson.dev}`;

  return {
    define: {
      // 将版本号注入到环境变量
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        "@": path.join(__dirname, "src"),
        '@openim/shared': path.join(__dirname, './packages/shared/src/index.ts'),
        'react': path.join(__dirname, 'node_modules/react'),
        'react-dom': path.join(__dirname, 'node_modules/react-dom'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["legacy-js-api"],
        },
      },
    },
    plugins: [
      react(),
      ...(!process.env.WEB_ONLY
        ? [
            electron({
              include: ["electron"],
              transformOptions: {
                sourcemap,
              },
              plugins: [
                ...(!!process.env.VSCODE_DEBUG
                  ? [
                      customStart(() =>
                        console.log("[startup] Electron App"),
                      ),
                    ]
                  : []),
                loadViteEnv(),
              ],
            }),
          ]
        : []),
    ],
    server: {
      watch: {
        ignored: ["**/open-im-sdk-core*", "**/OpenIM_v3_*", "**/logs/**"],
      },
    },
    clearScreen: false,
    build: {
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 500,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: process.env.BUILD_TARGET === 'web' && {
            "react": ["react", "react-dom", "react-router-dom", "zustand"],
            "openim-sdk": ["@openim/wasm-client-sdk"],
            "openim": ["@openim/shared"],
            "antd": ["antd", "@ant-design/icons"],
            "ui": ["@floating-ui/react", "react-draggable", "react-player", "react-virtuoso", "react-resizable-panels", "emoji-picker-element"],
            "utils": ["md5", "lodash", "uuid", "axios", "dayjs", "date-fns", "ahooks"],
            "markdown": ["react-markdown", "react-syntax-highlighter", "rehype-raw", "remark-gfm"],
            "editor": ["@tiptap/core", "@tiptap/react"]
          },
        },
      },
    },
  };
});
