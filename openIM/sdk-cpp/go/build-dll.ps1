$ErrorActionPreference = "Stop"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "1"
$env:GOPROXY = "https://goproxy.cn,direct"
$env:CC = "C:\mingw64\bin\gcc.exe"
$env:Path = "C:\mingw64\bin;C:\Go\bin;" + $env:Path

$SDK_CPP_GO = $PSScriptRoot
$BIN_DIR = Join-Path $SDK_CPP_GO "_output"
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null

Write-Host "Building libopenimsdk.dll from $SDK_CPP_GO ..."
Write-Host "Go version: $(C:\Go\bin\go.exe version)"
Write-Host "GCC version: $(C:\mingw64\bin\gcc.exe -dumpversion)"
Write-Host ""

Set-Location $SDK_CPP_GO
& C:\Go\bin\go.exe build -buildmode=c-shared -trimpath -ldflags "-s -w" -o (Join-Path $BIN_DIR "libopenimsdk.dll") .
if ($LASTEXITCODE -ne 0) { throw "DLL build failed with exit code $LASTEXITCODE" }

Write-Host ""
Write-Host "Build SUCCESS!"
Write-Host "DLL:    $(Join-Path $BIN_DIR 'libopenimsdk.dll')"
Write-Host "Header: $(Join-Path $BIN_DIR 'libopenimsdk.h')"
$dllSize = [math]::Round((Get-Item (Join-Path $BIN_DIR "libopenimsdk.dll")).Length / 1MB, 2)
Write-Host "Size:   $dllSize MB"
