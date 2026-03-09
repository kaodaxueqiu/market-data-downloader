const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");

// 恢复原始 package.json
const packageJsonPath = path.join(repoRoot, "package.json");
const backupPath = path.join(repoRoot, "package.json.backup");

if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, packageJsonPath);
  fs.unlinkSync(backupPath);
  console.log("Original package.json restored");
} else {
  console.log("No backup found, skipping restore");
}
