# OpenIM Build Tooling

This package hosts the build/release utilities used by the desktop app. It is
intended to be run from the repo root via the workspace scripts in
`package.json`, but you can also invoke the scripts directly.

## Quick Usage (from repo root)

```bash
# install ffi assets (auto-detect zip in repo root)
pnpm setup:ffi

# build workspace packages (when needed)
pnpm build:packages

# prepare/restore package.json for electron builds
pnpm prepare:dev
pnpm restore:package

# electron packaging
pnpm electron:build:dev
pnpm electron:build:prod -- --mac --arm64
```

## Scripts

All scripts are defined in `packages/build-tooling/package.json`.

### install-ffi-assets

Installs ffi libraries into `node_modules/@openim/electron-client-sdk/assets`.
Supports nested zip bundles like `macos-latest-*-assets.zip`.

```bash
pnpm --filter @openim/build-tooling run install-ffi-assets -- --zip /path/to/ffi-assets.zip
pnpm --filter @openim/build-tooling run install-ffi-assets -- --dir /path/to/extracted-assets
pnpm --filter @openim/build-tooling run install-ffi-assets -- --zip /path/to/ffi-assets.zip --dry-run
```

Options:

- `--zip <path>`: path to the outer zip bundle.
- `--dir <path>`: extracted directory (can include nested zips).
- `--dry-run`: print copy plan without writing files.

Notes:

- Automatically ignores macOS `__MACOSX` and `._*` zip artifacts.
- Matches `amd64/x64`, `arm64/aarch64`, and `ia32/x86` from file paths.

### prepare-package

Rewrites the root `package.json` to a minimal set of runtime dependencies for
packaging, and backs up the original to `package.json.backup`.

```bash
pnpm --filter @openim/build-tooling run prepare-package -- dev
pnpm --filter @openim/build-tooling run prepare-package -- prod
pnpm --filter @openim/build-tooling run prepare-package -- prod 1.2.3
```

Arguments:

- `<env>`: `dev` or `prod` (default: `dev`).
- `<version>`: optional override for `version`.

### restore-package

Restores `package.json` from `package.json.backup`.

```bash
pnpm --filter @openim/build-tooling run restore-package
```

### set-version

Updates `version.json` for the chosen environment.

```bash
pnpm --filter @openim/build-tooling run set-version -- dev 1.0.0-dev
pnpm --filter @openim/build-tooling run set-version -- prod 1.2.3
```

### electron-build

Builds the web app, prepares the package.json, runs `electron-builder`, then
restores the package.json.

```bash
pnpm --filter @openim/build-tooling run electron-build -- --mode dev
pnpm --filter @openim/build-tooling run electron-build -- --mode prod -- --mac --arm64
pnpm --filter @openim/build-tooling run electron-build -- --mode prod --all
pnpm --filter @openim/build-tooling run electron-build -- --mode prod -- --mac --arm64 --skip-packages
```

Options:

- `--mode <dev|prod>`: selects the build config (`electron-builder.<mode>.json5`).
- `--config <path>`: override electron-builder config path.
- `--all`: build win x64 + mac x64/arm64 combo.
- `--skip-packages`: skip `pnpm build:packages` before packaging.
- extra args after `--` are passed to `electron-builder`.

### release-all

Builds and uploads release artifacts (uses `electron:build:prod:all`).

```bash
pnpm --filter @openim/build-tooling run release-all -- --version 1.2.3 --text "Release notes"
```

Common options:

- `--version, -v`: release version.
- `--text`: release notes.
- `--api-base`: API base URL.
- `--object-base`: object storage API base.
- `--token`: admin token.
- `--user-id`: admin user id (default: `imAdmin`).
- `--skip-build` / `--no-build`: skip electron build.
- `--force`: overwrite existing remote files.
- `--hot`: mark as hot update.
- `--latest` / `--no-latest`: toggle latest tag.

Environment equivalents:

- `RELEASE_VERSION`, `RELEASE_TEXT`, `OPENIM_API_BASE`, `OPENIM_OBJECT_BASE`,
  `IM_ADMIN_TOKEN`, `IM_ADMIN_USER_ID`, `RELEASE_FORCE`, `RELEASE_LATEST`,
  `RELEASE_HOT`, `RELEASE_SKIP_BUILD`.

## Direct Node Usage

You can run scripts directly if needed:

```bash
node packages/build-tooling/install-ffi-assets.js -- --zip /path/to/ffi-assets.zip
node packages/build-tooling/prepare-package.js prod
node packages/build-tooling/restore-package.js
node packages/build-tooling/set-version.js dev 1.0.0-dev
node packages/build-tooling/electron-build.js --mode prod -- --mac --arm64
node packages/build-tooling/release/release-all.js --version 1.2.3
```
