#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const AdmZip = require("adm-zip");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);

const options = {
  zipPath: null,
  dirPath: null,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--") {
    continue;
  }
  if (arg === "--zip" && args[i + 1]) {
    options.zipPath = args[i + 1];
    i += 1;
    continue;
  }
  if (arg.startsWith("--zip=")) {
    options.zipPath = arg.split("=").slice(1).join("=");
    continue;
  }
  if (arg === "--dir" && args[i + 1]) {
    options.dirPath = args[i + 1];
    i += 1;
    continue;
  }
  if (arg.startsWith("--dir=")) {
    options.dirPath = arg.split("=").slice(1).join("=");
    continue;
  }
  if (arg === "--dry-run") {
    options.dryRun = true;
    continue;
  }
}

const resolveInputPath = (inputPath) =>
  path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);

const fileExists = (inputPath) => {
  try {
    return fs.existsSync(inputPath);
  } catch {
    return false;
  }
};

const isIgnoredZipPath = (zipPath) => {
  const normalized = zipPath.replace(/\\/g, "/");
  const baseName = path.basename(zipPath);
  if (baseName.startsWith("._")) return true;
  if (normalized.includes("/__MACOSX/")) return true;
  if (baseName.toLowerCase() === ".ds_store") return true;
  return false;
};

const collectZipCandidates = () => {
  const searchDirs = [
    repoRoot,
    path.join(repoRoot, "assets"),
    path.join(repoRoot, "downloads"),
  ];
  const candidates = [];
  for (const dir of searchDirs) {
    if (!fileExists(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".zip")) continue;
      const candidate = path.join(dir, entry.name);
      if (isIgnoredZipPath(candidate)) continue;
      candidates.push(candidate);
    }
  }

  const preferred = candidates.filter((candidate) => {
    const name = path.basename(candidate).toLowerCase();
    return name.includes("ffi") || name.includes("asset");
  });

  if (preferred.length === 1) return preferred[0];
  if (preferred.length > 1) {
    throw new Error(
      `Multiple ffi zip files detected:\n${preferred.map((p) => `- ${p}`).join("\n")}\nPlease pass --zip <path>.`,
    );
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new Error(
      `Multiple zip files detected:\n${candidates.map((p) => `- ${p}`).join("\n")}\nPlease pass --zip <path>.`,
    );
  }
  return null;
};

const tryCommand = (command, commandArgs) => {
  try {
    const result = spawnSync(command, commandArgs, { stdio: "ignore" });
    return result.status === 0;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    return false;
  }
};

const escapePowerShell = (value) => String(value).replace(/'/g, "''");

const extractWithSystem = (zipPath, outDir) => {
  if (process.platform === "win32") {
    const command = `Expand-Archive -Force -LiteralPath '${escapePowerShell(
      zipPath,
    )}' -DestinationPath '${escapePowerShell(outDir)}'`;
    return tryCommand("powershell", ["-NoProfile", "-Command", command]);
  }

  if (tryCommand("unzip", ["-o", zipPath, "-d", outDir])) return true;
  if (tryCommand("tar", ["-xf", zipPath, "-C", outDir])) return true;
  if (tryCommand("python3", ["-m", "zipfile", "-e", zipPath, outDir])) return true;
  if (tryCommand("python", ["-m", "zipfile", "-e", zipPath, outDir])) return true;

  return false;
};

const extractZip = (zipPath, outDir, { required }) => {
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(outDir, true);
    return true;
  } catch (error) {
    const fallbackOk = extractWithSystem(zipPath, outDir);
    if (fallbackOk) return true;

    const message = error && error.message ? error.message : "unknown error";
    if (required) {
      console.error(`Failed to extract zip: ${zipPath}`);
      console.error(message);
    } else {
      console.warn(`Skipped zip (cannot extract): ${zipPath}`);
      console.warn(message);
    }
    return false;
  }
};

const sdkAssetsDir = path.join(
  repoRoot,
  "node_modules",
  "@openim",
  "electron-client-sdk",
  "assets",
);

if (!fileExists(sdkAssetsDir)) {
  console.error("electron-client-sdk assets directory not found:", sdkAssetsDir);
  process.exit(1);
}

if (options.zipPath && options.dirPath) {
  console.error("Use either --zip or --dir, not both.");
  process.exit(1);
}

let sourceRoot = null;
let tempDir = null;
let nestedTempDir = null;
const cleanupTempDirs = () => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (nestedTempDir) {
    fs.rmSync(nestedTempDir, { recursive: true, force: true });
  }
};

if (options.dirPath) {
  const resolved = resolveInputPath(options.dirPath);
  if (!fileExists(resolved)) {
    console.error("Directory not found:", resolved);
    process.exit(1);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    console.error("Expected a directory for --dir, got:", resolved);
    process.exit(1);
  }
  sourceRoot = resolved;
} else {
  const zipPath = options.zipPath
    ? resolveInputPath(options.zipPath)
    : collectZipCandidates();

  if (!zipPath) {
    console.error(
      "No ffi assets zip found. Pass --zip <path> or place a zip in the repo root.",
    );
    process.exit(1);
  }

  if (!fileExists(zipPath)) {
    console.error("Zip file not found:", zipPath);
    process.exit(1);
  }

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openim-ffi-assets-"));
  const extracted = extractZip(zipPath, tempDir, { required: true });
  if (!extracted) {
    cleanupTempDirs();
    process.exit(1);
  }
  sourceRoot = tempDir;
}

const normalize = (input) => input.replace(/[^a-z0-9]+/gi, " ").toLowerCase();

const resolveArch = (...inputs) => {
  const normalized = normalize(inputs.filter(Boolean).join(" "));
  if (/(arm64|aarch64)/.test(normalized)) return "arm64";
  if (/(x64|x86_64|amd64)/.test(normalized)) return "x64";
  if (/(ia32|x86|i386)/.test(normalized)) return "ia32";
  if (/win64/.test(normalized)) return "x64";
  if (/win32/.test(normalized)) return "ia32";
  return null;
};

const resolvePlatform = (ext) => {
  if (ext === ".dylib") return "mac";
  if (ext === ".dll") return "win";
  if (ext === ".so") return "linux";
  return null;
};

const platformDirMap = {
  mac: { arm64: "mac_arm64", x64: "mac_x64" },
  win: { ia32: "win_ia32", x64: "win_x64" },
  linux: { arm64: "linux_arm64", x64: "linux_x64" },
};

const walk = (dir, collected = [], depth = 0, maxDepth = Infinity) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < maxDepth) {
        walk(fullPath, collected, depth + 1, maxDepth);
      }
    } else {
      collected.push(fullPath);
    }
  }
  return collected;
};

const collectZipFiles = (dir, maxDepth) =>
  walk(dir, [], 0, maxDepth).filter((filePath) => {
    if (!filePath.toLowerCase().endsWith(".zip")) return false;
    return !isIgnoredZipPath(filePath);
  });

const sanitizeName = (value) => value.replace(/[^a-z0-9._-]+/gi, "_");

const extractZipQueue = (zipFiles, extractRoot) => {
  const extractedRoots = [];
  let counter = 0;
  const queue = [...zipFiles];
  const seen = new Set(queue);

  while (queue.length > 0) {
    const zipPath = queue.shift();
    if (isIgnoredZipPath(zipPath)) {
      continue;
    }
    const baseName = sanitizeName(path.basename(zipPath, ".zip")) || "archive";
    const outDir = path.join(extractRoot, `${baseName}-${counter++}`);
    const extracted = extractZip(zipPath, outDir, { required: false });
    if (extracted) {
      extractedRoots.push(outDir);
    }

    const nestedZips = extracted ? collectZipFiles(outDir, 3) : [];
    for (const nested of nestedZips) {
      if (seen.has(nested)) continue;
      seen.add(nested);
      queue.push(nested);
    }
  }

  return extractedRoots;
};

const scanRoots = [sourceRoot];
const zipSearchDepth = sourceRoot === repoRoot ? 0 : 3;
const nestedZipFiles = collectZipFiles(sourceRoot, zipSearchDepth);
if (nestedZipFiles.length) {
  nestedTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openim-ffi-nested-"));
  scanRoots.push(...extractZipQueue(nestedZipFiles, nestedTempDir));
}

const fileEntries = [];
for (const root of scanRoots) {
  fileEntries.push(
    ...walk(root).map((filePath) => ({ root, filePath })),
  );
}
const targets = new Map();
const skipped = [];

for (const { root, filePath } of fileEntries) {
  const ext = path.extname(filePath).toLowerCase();
  const platform = resolvePlatform(ext);
  if (!platform) continue;

  const relativePath = path.relative(root, filePath);
  const arch = resolveArch(relativePath, path.basename(root));
  if (!arch) {
    skipped.push({ filePath, reason: "missing-arch" });
    continue;
  }

  const platformDir = platformDirMap[platform][arch];
  if (!platformDir) {
    skipped.push({ filePath, reason: "unsupported-arch" });
    continue;
  }

  const destDir = path.join(sdkAssetsDir, platformDir);
  const destPath = path.join(destDir, path.basename(filePath));
  if (!targets.has(destPath)) {
    targets.set(destPath, filePath);
  } else {
    skipped.push({ filePath, reason: `duplicate (${destPath})` });
  }
}

if (targets.size === 0) {
  console.error("No ffi assets found in", sourceRoot);
  cleanupTempDirs();
  process.exit(1);
}

if (skipped.length) {
  console.warn("Skipped some files:");
  for (const item of skipped) {
    console.warn(`- ${item.filePath} (${item.reason})`);
  }
}

if (options.dryRun) {
  console.log("Dry run: would install files:");
  for (const [dest, src] of targets.entries()) {
    console.log(`- ${src} -> ${dest}`);
  }
  cleanupTempDirs();
  process.exit(0);
}

for (const [dest, src] of targets.entries()) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

cleanupTempDirs();

console.log(`Installed ${targets.size} ffi asset(s) to ${sdkAssetsDir}`);
