$ErrorActionPreference = "Stop"
$env:GOOS = "js"
$env:GOARCH = "wasm"
$env:CGO_ENABLED = "0"
$env:GOPROXY = "https://goproxy.cn,direct"

$SDK_ROOT = $PSScriptRoot
$BIN_DIR = Join-Path $SDK_ROOT "_output\bin"
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null

Write-Host "Building WASM from $SDK_ROOT ..."
& C:\Go\bin\go.exe build -trimpath -ldflags "-s -w" -o (Join-Path $BIN_DIR "openIM.wasm") (Join-Path $SDK_ROOT "wasm\cmd\main.go")
if ($LASTEXITCODE -ne 0) { throw "WASM build failed with exit code $LASTEXITCODE" }
Write-Host "WASM build OK: $(Join-Path $BIN_DIR 'openIM.wasm')"
Write-Host "Size: $((Get-Item (Join-Path $BIN_DIR 'openIM.wasm')).Length / 1MB) MB"
