$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  OpenIM SDK 统一编译部署脚本" -ForegroundColor Cyan
Write-Host "  编译 WASM + DLL 并部署到 node_modules" -ForegroundColor Cyan
Write-Host "  用法: powershell -File openIM/build-sdk.ps1" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
$ROOT = $PSScriptRoot

$WASM_SRC   = Join-Path $ROOT "sdk-core"
$DLL_SRC    = Join-Path $ROOT "sdk-cpp\go"
$WASM_DEST  = Join-Path $ROOT "electron-client\app\node_modules\@openim\wasm-client-sdk\assets\openIM.wasm"
$DLL_DEST   = Join-Path $ROOT "electron-client\app\node_modules\@openim\electron-client-sdk\assets\win_x64\libopenimsdk.dll"

Write-Host "========== 1/3 Building WASM (sdk-core) =========="
$env:GOOS = "js"; $env:GOARCH = "wasm"; $env:CGO_ENABLED = "0"; $env:GOPROXY = "https://goproxy.cn,direct"
& C:\Go\bin\go.exe build -trimpath -ldflags "-s -w" -o (Join-Path $WASM_SRC "_output\bin\openIM.wasm") (Join-Path $WASM_SRC "wasm\cmd\main.go")
if ($LASTEXITCODE -ne 0) { throw "WASM build failed" }
Write-Host "WASM build OK"

Write-Host ""
Write-Host "========== 2/3 Building DLL (sdk-cpp/go) =========="
Push-Location $DLL_SRC
$env:GOOS = "windows"; $env:GOARCH = "amd64"; $env:CGO_ENABLED = "1"
$env:CC = "C:\mingw64\bin\gcc.exe"; $env:Path = "C:\mingw64\bin;C:\Go\bin;" + $env:Path
& C:\Go\bin\go.exe build -buildmode=c-shared -trimpath -ldflags "-s -w" -o (Join-Path $DLL_SRC "_output\libopenimsdk.dll") .
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "DLL build failed" }
Pop-Location
Write-Host "DLL build OK"

Write-Host ""
Write-Host "========== 3/3 Deploying =========="
Copy-Item (Join-Path $WASM_SRC "_output\bin\openIM.wasm") $WASM_DEST -Force
Write-Host "WASM -> $WASM_DEST"

Copy-Item (Join-Path $DLL_SRC "_output\libopenimsdk.dll") $DLL_DEST -Force
Write-Host "DLL  -> $DLL_DEST"

$wasmSize = [math]::Round((Get-Item $WASM_DEST).Length / 1MB, 2)
$dllSize  = [math]::Round((Get-Item $DLL_DEST).Length / 1MB, 2)
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  编译部署完成!" -ForegroundColor Green
Write-Host "  WASM: $wasmSize MB" -ForegroundColor Green
Write-Host "  DLL:  $dllSize MB" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  注意: Electron 需要重启才能加载新 DLL" -ForegroundColor Yellow
Write-Host "  注意: WASM 修改需要刷新页面生效" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
