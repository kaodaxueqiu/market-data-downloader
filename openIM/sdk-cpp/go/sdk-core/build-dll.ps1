$ErrorActionPreference = "Stop"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "1"
$env:GOPROXY = "https://goproxy.cn,direct"
$env:CC = "C:\mingw64\bin\gcc.exe"
$env:Path = "C:\mingw64\bin;" + $env:Path

$SDK_ROOT = $PSScriptRoot
$BIN_DIR = Join-Path $SDK_ROOT "_output\bin"
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null

Write-Host "Building Windows DLL (c-shared) from $SDK_ROOT ..."
& C:\Go\bin\go.exe build -buildmode=c-shared -trimpath -ldflags "-s -w" -o (Join-Path $BIN_DIR "libopenimsdk.dll") (Join-Path $SDK_ROOT "cmd\main.go")
if ($LASTEXITCODE -ne 0) { throw "DLL build failed with exit code $LASTEXITCODE" }
Write-Host "DLL build OK: $(Join-Path $BIN_DIR 'libopenimsdk.dll')"
Write-Host "Size: $([math]::Round((Get-Item (Join-Path $BIN_DIR 'libopenimsdk.dll')).Length / 1MB, 2)) MB"

if (Test-Path (Join-Path $BIN_DIR "libopenimsdk.h")) {
    Write-Host "Header: $(Join-Path $BIN_DIR 'libopenimsdk.h')"
}
