const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const repoRoot = path.resolve(__dirname, "..");
const ffiDir = path.resolve(repoRoot, "..", "..", "ffi-assets");
const sdkAssetsDir = path.join(
  repoRoot,
  "node_modules",
  "@openim",
  "electron-client-sdk",
  "assets",
);

const platformMap = {
  "windows-latest-amd64": "win_x64",
  "ubuntu-latest-amd64": "linux_x64",
  "ubuntu-latest-arm64": "linux_arm64",
  "macos-latest-arm64": "mac_arm64",
  "macos-latest-amd64": "mac_x64",
};

let installed = 0;

for (const [zipPrefix, targetDir] of Object.entries(platformMap)) {
  const zipName = `${zipPrefix}-assets.zip`;
  const zipPath = path.join(ffiDir, zipName);

  if (!fs.existsSync(zipPath)) continue;

  const destDir = path.join(sdkAssetsDir, targetDir);
  fs.mkdirSync(destDir, { recursive: true });

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const ext = path.extname(entry.entryName).toLowerCase();
      if (![".dll", ".dylib", ".so", ".h"].includes(ext)) continue;

      const destPath = path.join(destDir, path.basename(entry.entryName));
      fs.writeFileSync(destPath, entry.getData());
      installed++;
    }
  } catch (err) {
    console.error(`Failed to extract ${zipPath}:`, err.message);
  }
}

if (installed > 0) {
  console.log(`Installed ${installed} ffi asset(s) to ${sdkAssetsDir}`);
} else {
  const existing = fs.readdirSync(sdkAssetsDir, { recursive: true }).filter(
    (f) => /\.(dll|dylib|so)$/i.test(String(f)),
  );
  if (existing.length) {
    console.log(`FFI assets already present (${existing.length} lib(s)), skipping.`);
  } else {
    console.error("No ffi assets found in", ffiDir);
    process.exit(1);
  }
}
