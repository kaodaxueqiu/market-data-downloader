#!/usr/bin/env node

const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);

const options = {
  mode: "dev",
  config: null,
  all: false,
  buildPackages: true,
  builderArgs: [],
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--") {
    continue;
  }
  if (arg === "--mode" || arg === "-m") {
    options.mode = args[i + 1] || options.mode;
    i += 1;
    continue;
  }
  if (arg.startsWith("--mode=")) {
    options.mode = arg.split("=").slice(1).join("=");
    continue;
  }
  if (arg === "--config") {
    options.config = args[i + 1] || options.config;
    i += 1;
    continue;
  }
  if (arg.startsWith("--config=")) {
    options.config = arg.split("=").slice(1).join("=");
    continue;
  }
  if (arg === "--all") {
    options.all = true;
    continue;
  }
  if (arg === "--skip-packages") {
    options.buildPackages = false;
    continue;
  }
  options.builderArgs.push(arg);
}

if (!["dev", "prod"].includes(options.mode)) {
  console.error("Mode must be either dev or prod");
  process.exit(1);
}

const config = options.config || `electron-builder.${options.mode}.json5`;

const run = (command) => {
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
};

if (options.buildPackages) {
  run("pnpm run build:packages");
}
run(`pnpm run build:${options.mode}`);
run(`pnpm run prepare:${options.mode}`);

if (options.all) {
  run(`electron-builder --config ${config} --win --x64`);
  run(`electron-builder --config ${config} --mac --x64 --arm64`);
} else {
  const builderArgs = options.builderArgs.join(" ");
  run(`electron-builder --config ${config}${builderArgs ? " " + builderArgs : ""}`);
}

run("pnpm run restore:package");
