$ErrorActionPreference = "Stop"
$GO = "C:\Go\bin\go.exe"
$SDK_ROOT = $PSScriptRoot
$BIN_DIR = Join-Path $SDK_ROOT "_output\bin"
$EXTRA_RES = Join-Path $SDK_ROOT "..\electron-client\app\extraResources"

New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null

Write-Host "========== Building WASM =========="
$env:GOOS = "js"
$env:GOARCH = "wasm"
$env:CGO_ENABLED = "0"
$env:GOPROXY = "https://goproxy.cn,direct"
& $GO build -trimpath -ldflags "-s -w" -o "$BIN_DIR\openIM.wasm" "$SDK_ROOT\wasm\cmd\main.go"
if ($LASTEXITCODE -ne 0) { throw "WASM build failed" }
Write-Host "WASM build OK: $BIN_DIR\openIM.wasm"

Write-Host ""
Write-Host "========== Building Windows DLL (CGO) =========="
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "1"
& $GO build -buildmode=c-shared -trimpath -ldflags "-s -w" -o "$BIN_DIR\libopenimsdk.dll" "$SDK_ROOT\cmd\main.go"
if ($LASTEXITCODE -ne 0) { throw "DLL build failed" }
Write-Host "DLL build OK: $BIN_DIR\libopenimsdk.dll"

Write-Host ""
Write-Host "========== Replacing extraResources =========="
Copy-Item "$BIN_DIR\libopenimsdk.dll" "$EXTRA_RES\libopenimsdk.dll" -Force
if (Test-Path "$BIN_DIR\libopenimsdk.h") {
    Copy-Item "$BIN_DIR\libopenimsdk.h" "$EXTRA_RES\libopenimsdk.h" -Force
}
Write-Host "Replaced extraResources OK"

Write-Host ""
Write-Host "========== Done =========="
Write-Host "WASM: $BIN_DIR\openIM.wasm"
Write-Host "DLL:  $BIN_DIR\libopenimsdk.dll"
