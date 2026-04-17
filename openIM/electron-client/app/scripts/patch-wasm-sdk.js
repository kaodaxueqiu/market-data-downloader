/**
 * 原生库同步脚本（postinstall 触发）。
 *
 * 背景：@openim/electron-client-sdk 和 @openim/wasm-client-sdk 已经作为
 * workspace 包固化在 packages/ 目录里（含所有企业版魔改），不再从 npm 下载，
 * 也不再需要字符串注入式的 patch。
 *
 * 这个脚本仅剩一个职责：把 sdk-core / sdk-cpp 的最新编译产物复制到
 * 两个 workspace 包的 assets 目录，保证 IM 运行时用的是我们自己编译的企业版
 * 二进制。
 *
 * 注意：
 * - 脚本只有在 build 完 sdk-core/sdk-cpp 后才会产生文件；如果 _output
 *   下还没有对应产物，本脚本会 silent skip，不影响 pnpm install。
 * - CI 里另有一步 "Setup FFI assets" 会在 go build 之后显式地 cp 到
 *   node_modules/@openim/electron-client-sdk/assets/（通过 workspace
 *   symlink 实际写入 packages/electron-client-sdk/assets/），所以 CI 上
 *   不依赖此脚本做原生库替换；本脚本主要服务本地开发场景。
 */

const fs = require('fs');
const path = require('path');

const WASM_SDK_ASSETS = path.join(
  __dirname,
  '..',
  'packages',
  'wasm-client-sdk',
  'assets'
);
const ELECTRON_SDK_ASSETS = path.join(
  __dirname,
  '..',
  'packages',
  'electron-client-sdk',
  'assets'
);

// 1. WASM: 用 sdk-core 编译产物覆盖 wasm-client-sdk/assets/openIM.wasm
const wasmBuilt = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'sdk-core',
  '_output',
  'bin',
  'openIM.wasm'
);
const wasmTarget = path.join(WASM_SDK_ASSETS, 'openIM.wasm');

if (fs.existsSync(wasmBuilt) && fs.existsSync(WASM_SDK_ASSETS)) {
  const builtSize = fs.statSync(wasmBuilt).size;
  const targetSize = fs.existsSync(wasmTarget) ? fs.statSync(wasmTarget).size : 0;
  if (builtSize !== targetSize) {
    fs.copyFileSync(wasmBuilt, wasmTarget);
    console.log(
      `[sync-native] Replaced WASM (${(builtSize / 1024 / 1024).toFixed(1)} MB)`
    );
  } else {
    console.log('[sync-native] WASM OK (already enterprise build)');
  }
}

// 2. 原生库: 用 sdk-cpp 编译产物覆盖 electron-client-sdk/assets/<platform>/
const SDK_OUTPUT = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'sdk-cpp',
  'go',
  '_output'
);
const NATIVE_LIB_MAP = {
  win32: { file: 'libopenimsdk.dll', dirs: ['win_x64', 'win_ia32'] },
  darwin: { file: 'libopenimsdk.dylib', dirs: ['mac_arm64', 'mac_x64'] },
  linux: { file: 'libopenimsdk.so', dirs: ['linux_arm64', 'linux_x64'] },
};

const libInfo = NATIVE_LIB_MAP[process.platform];
if (libInfo) {
  const builtLib = path.join(SDK_OUTPUT, libInfo.file);
  if (fs.existsSync(builtLib)) {
    const builtSize = fs.statSync(builtLib).size;
    for (const dir of libInfo.dirs) {
      const target = path.join(ELECTRON_SDK_ASSETS, dir, libInfo.file);
      if (!fs.existsSync(path.dirname(target))) continue;
      const targetSize = fs.existsSync(target) ? fs.statSync(target).size : 0;
      if (builtSize !== targetSize) {
        fs.copyFileSync(builtLib, target);
        console.log(
          `[sync-native] Replaced ${dir}/${libInfo.file} (${(
            builtSize /
            1024 /
            1024
          ).toFixed(1)} MB)`
        );
      } else {
        console.log(
          `[sync-native] ${dir}/${libInfo.file} OK (already enterprise build)`
        );
      }
    }
  }
}
