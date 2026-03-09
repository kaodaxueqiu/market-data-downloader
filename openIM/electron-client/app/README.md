# OpenIM Electron 💬💻

<p>
  <a href="https://docs.openim.io/">OpenIM Docs</a>
  •
  <a href="https://github.com/openimsdk/open-im-server">OpenIM Server</a>
  •
  <a href="https://github.com/openimsdk/open-im-sdk-web-wasm">openim-sdk-wasm</a>
  •
  <a href="https://github.com/openimsdk/openim-sdk-core">openim-sdk-core</a>
</p>
<br>

OpenIM Electron is a instant messaging application built on OpenIM SDK Wasm, OpenIM Server, and Electron. It demonstrates how to quickly integrate instant messaging capabilities into any web app using OpenIM.

## Tech Stack 🛠️

- This is a [`Electron`](https://www.electronjs.org/) project bootstrapped with [`Vite`](https://vitejs.dev/).
- App is built with [openim-sdk-wasm](https://github.com/openimsdk/open-im-sdk-web-wasm) library.

## Third-Party Dependencies

- **Twemoji**
  - **Author:** Twitter, Inc.
  - **License:** CC BY 4.0
  - **License URL:** https://creativecommons.org/licenses/by/4.0/
  - **Repository:** https://github.com/twitter/twemoji
  - **Notes:** This project uses the Twemoji icon library under CC BY 4.0. Proper attribution is provided here.

## Dev Setup 🛠️

> It is recommended to use node version 22.18.0 and pnpm as the package manager.

Follow these steps to set up a local development environment:

1. Run `pnpm install` to install all dependencies.
2. Install ffi assets(like: electron-ffi-assets-v3.8.4-alpha.8-e-v1.1.11.zip) into `node_modules/@openim/electron-client-sdk/assets` (supports nested bundles like `macos-latest-*-assets.zip`):

   ```bash
   # auto-detect a zip in the repo root (name can vary)
   pnpm setup:ffi

   # or specify a zip path explicitly
   pnpm setup:ffi -- --zip /path/to/electron-ffi-assets-v3.8.4-alpha.8-e-v1.1.11.zip

   # or point to an extracted directory (can contain nested zips)
   pnpm setup:ffi -- --dir /path/to/electron-ffi-assets-v3.8.4-alpha.8-e-v1.1.11
   ```

3. Configure environment variables:

   > Note: You need to [deploy](https://docs.openim.io/guides/gettingStarted/dockerCompose) OpenIM Server first, the default port of OpenIM Server is 10001, 10002, 10008.

   Create environment files or modify the existing ones:
   - `.env.development` - Development environment configuration
   - `.env.production` - Production environment configuration

   Example configuration:

   ```env
   # Server URLs
   VITE_WS_URL=ws://your-server-ip:10001
   VITE_API_URL=http://your-server-ip:10002
   VITE_CHAT_URL=http://your-server-ip:10008
   VITE_AGENT_URL=http://your-server-ip:10010

   # App Info
   VITE_APP_NAME=DEV-ER  # or OpenCorp-ER for production
   VITE_SDK_VERSION=SDK(ffi) v3.8.4-alpha.4-e-v1.1.11
   ```

   **Note**: App version is managed in `version.json` file:

   ```json
   {
     "prod": "3.8.4+2",
     "dev": "1.0.0-dev"
   }
   ```

4. Build workspace packages when needed:

   ```bash
   pnpm build:packages
   # or watch mode for packages
   pnpm dev:packages
   ```

5. Run `pnpm dev` to start the development server. Visit [http://localhost:5173](http://localhost:5173) to see the result. An Electron application will be launched by default.
6. Start development! 🎉

## Build 🚀

> This project supports building for both development and production environments with separate configurations.

### Web Application

1. Run the following commands to build the web application:

   ```bash
   # Development build
   pnpm build:dev

   # Production build
   pnpm build:prod
   ```

2. The build result will be located in the `dist` folder.

### Electron Application

The project now includes automated build scripts that handle package preparation and restoration:

#### Development Build

```bash
# Build using default targets on the current OS
pnpm electron:build:dev

# Platform-specific builds (args passthrough to electron-builder)
pnpm electron:build:dev -- --mac --arm64
pnpm electron:build:dev -- --win --x64
pnpm electron:build:dev -- --linux --x64
```

#### Production Build

```bash
# Build using default targets on the current OS
pnpm electron:build:prod

# Platform-specific builds (args passthrough to electron-builder)
pnpm electron:build:prod -- --mac --arm64
pnpm electron:build:prod -- --win --x64
pnpm electron:build:prod -- --linux --x64

# Common release combo (Win x64 + macOS x64/arm64)
pnpm electron:build:prod:all
```

#### Build Process Details

1. **Automatic Version Management**: The build scripts automatically set the appropriate version based on the environment.
2. **Package Preparation**: The scripts automatically prepare the package.json for building (removing unnecessary dependencies).
3. **Build Configuration**:
   - Development builds use `electron-builder.dev.json5`
   - Production builds use `electron-builder.prod.json5`
4. **Package Restoration**: After building, the original package.json is automatically restored.
5. **Output Directory**: Build results are located in the `release/ER/${version}` folder.

#### Build Configuration Files

- `electron-builder.dev.json5` - Development build configuration
  - App ID: `io.opencorp.dev.desktop.er`
  - Product Name: `DEV-ER`
  - NSIS GUID: `f7d2e3a1-8b9c-4d5e-a6f3-9e8c7b6d5a4f`

- `electron-builder.prod.json5` - Production build configuration
  - App ID: `io.opencorp.desktop.er`
  - Product Name: `OpenCorp-ER`
  - NSIS GUID: `a8f5e9c4-3b2d-4e1f-9c8a-7d6b5e4a3c2b`

## Who are using OpenIM :eyes:

Check out our [user case studies](https://github.com/OpenIMSDK/community/blob/main/ADOPTERS.md) page for a list of the project users. Don't hesitate to leave a [📝comment](https://github.com/openimsdk/open-im-server/issues/379) and share your use case.

## License :page_facing_up:

OpenIM Electron is licensed under the AGPL 3.0 license.
