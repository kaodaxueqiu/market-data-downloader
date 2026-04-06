const fs = require('fs');
const path = require('path');

const PATCHES = [
  {
    // CREATE TABLE: add session_id column before PRIMARY KEY
    find: "'msg_first_modify_time' int,\\n        PRIMARY KEY ('client_msg_id')",
    replace: "'msg_first_modify_time' int,\\n        'session_id' varchar(128) DEFAULT '',\\n        PRIMARY KEY ('client_msg_id')",
  },
  {
    // Field mapping array: add session_id <-> sessionId
    find: '["dst_user_ids","dstUserIDs"]',
    replace: '["dst_user_ids","dstUserIDs"],["session_id","sessionId"]',
  },
];

const SDK_DIR = path.join(
  __dirname,
  '..',
  'node_modules',
  '@openim',
  'wasm-client-sdk',
  'lib'
);

const FILES = ['worker.js', 'worker-legacy.js'];

let patched = 0;

for (const file of FILES) {
  const filePath = path.join(SDK_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-wasm-sdk] SKIP ${file} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const { find, replace } of PATCHES) {
    if (content.includes(replace)) continue; // already patched
    if (!content.includes(find)) {
      console.warn(`[patch-wasm-sdk] WARN ${file}: target string not found for patch`);
      continue;
    }
    content = content.replace(find, replace);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[patch-wasm-sdk] PATCHED ${file}`);
    patched++;
  } else {
    console.log(`[patch-wasm-sdk] OK ${file} (already patched)`);
  }
}

console.log(`[patch-wasm-sdk] Done. ${patched} file(s) patched.`);

// Replace WASM with enterprise build if available
const wasmBuilt = path.join(__dirname, '..', '..', '..', 'sdk-core', '_output', 'bin', 'openIM.wasm');
const wasmTarget = path.join(__dirname, '..', 'node_modules', '@openim', 'wasm-client-sdk', 'assets', 'openIM.wasm');

if (fs.existsSync(wasmBuilt) && fs.existsSync(path.dirname(wasmTarget))) {
  const builtSize = fs.statSync(wasmBuilt).size;
  const targetSize = fs.existsSync(wasmTarget) ? fs.statSync(wasmTarget).size : 0;
  if (builtSize !== targetSize) {
    fs.copyFileSync(wasmBuilt, wasmTarget);
    console.log(`[patch-wasm-sdk] Replaced WASM (${(builtSize / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`[patch-wasm-sdk] WASM OK (already enterprise build)`);
  }
}

// Patch electron-client-sdk: add unhideConversation + FFI binding
const ELECTRON_SDK_DIR = path.join(__dirname, '..', 'node_modules', '@openim', 'electron-client-sdk', 'lib');
const ELECTRON_SDK_FILES = ['index.js', 'index.es.js'];

const ELECTRON_PATCHES = [
  {
    find: "hideAllConversation:",
    inject: `        unhideConversation: (conversationID, opid = ${/index\.es\.js/.test('') ? 'v4' : 'uuid.v4'}()) => new Promise((resolve, reject) => {\n            openIMSDK.libOpenIMSDK.unhide_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);\n        }),\n        hideAllConversation:`,
  },
  {
    find: "this.libOpenIMSDK.set_conversation_draft",
    inject: "try { this.libOpenIMSDK.unhide_conversation = this.lib.func('__stdcall', 'unhide_conversation', 'void', ['baseCallback *', 'str', 'str']); } catch(e) {}\n            this.libOpenIMSDK.set_conversation_draft",
  },
];

for (const file of ELECTRON_SDK_FILES) {
  const filePath = path.join(ELECTRON_SDK_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  if (content.includes('unhide_conversation')) {
    console.log(`[patch-electron-sdk] OK ${file} (already patched)`);
    continue;
  }

  for (const { find, inject } of ELECTRON_PATCHES) {
    let replacement = inject;
    if (file === 'index.es.js') {
      replacement = replacement.replace('uuid.v4', 'v4');
    }
    if (content.includes(find)) {
      content = content.replace(find, replacement);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[patch-electron-sdk] PATCHED ${file}`);
  }
}

// Replace native library with enterprise build if available
const SDK_OUTPUT = path.join(__dirname, '..', '..', '..', 'sdk-cpp', 'go', '_output');
const NATIVE_LIB_MAP = {
  win32:  { file: 'libopenimsdk.dll',   dirs: ['win_x64', 'win_ia32'] },
  darwin: { file: 'libopenimsdk.dylib', dirs: ['mac_arm64', 'mac_x64'] },
  linux:  { file: 'libopenimsdk.so',    dirs: ['linux_arm64', 'linux_x64'] },
};

const libInfo = NATIVE_LIB_MAP[process.platform];
if (libInfo) {
  const builtLib = path.join(SDK_OUTPUT, libInfo.file);
  if (fs.existsSync(builtLib)) {
    const builtSize = fs.statSync(builtLib).size;
    for (const dir of libInfo.dirs) {
      const target = path.join(ELECTRON_SDK_DIR, '..', 'assets', dir, libInfo.file);
      if (!fs.existsSync(path.dirname(target))) continue;
      const targetSize = fs.existsSync(target) ? fs.statSync(target).size : 0;
      if (builtSize !== targetSize) {
        fs.copyFileSync(builtLib, target);
        console.log(`[patch-electron-sdk] Replaced ${dir}/${libInfo.file} (${(builtSize / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        console.log(`[patch-electron-sdk] ${dir}/${libInfo.file} OK (already enterprise build)`);
      }
    }
  }
}
