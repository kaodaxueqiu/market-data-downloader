$dumpbin = $null
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -property installationPath 2>$null
    if ($vsPath) {
        $dumpbin = Get-ChildItem "$vsPath" -Recurse -Filter "dumpbin.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    }
}

$newDll = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\sdk-cpp\go\_output\libopenimsdk.dll"
$headerFile = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\electron-client\app\extraResources\libopenimsdk.h"

Write-Host "===== Verification Report ====="
Write-Host ""

$newInfo = Get-Item $newDll
Write-Host "DLL Size: $([math]::Round($newInfo.Length/1MB,2)) MB"
Write-Host "DLL Date: $($newInfo.LastWriteTime)"
Write-Host ""

Write-Host "--- Expected exports from header ---"
$headerContent = Get-Content $headerFile -Raw
$exports = [regex]::Matches($headerContent, 'extern\s+__declspec\(dllexport\)\s+\S+\s+(\w+)\(') | ForEach-Object { $_.Groups[1].Value }
$exportCount = $exports.Count
Write-Host "Total expected: $exportCount functions"
Write-Host ""

if ($dumpbin) {
    Write-Host "--- Actual DLL exports (dumpbin) ---"
    $output = & $dumpbin /exports $newDll 2>&1
    $actualExports = $output | Select-String '^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]+\s+(\w+)' | ForEach-Object { $_.Matches.Groups[1].Value }
    Write-Host "Total actual: $($actualExports.Count) functions"
    Write-Host ""

    Write-Host "--- Missing functions ---"
    $missing = $exports | Where-Object { $_ -notin $actualExports }
    if ($missing) {
        $missing | ForEach-Object { Write-Host "  MISSING: $_" }
    } else {
        Write-Host "  None! All $exportCount functions present."
    }
} else {
    Write-Host "(dumpbin not found, using Go nm instead)"
    $goExe = "C:\Go\bin\go.exe"
    $env:Path = "C:\Go\bin;C:\mingw64\bin;" + $env:Path
    
    $nmOutput = & C:\mingw64\bin\nm.exe -D --defined-only $newDll 2>&1
    $actualExports = @()
    foreach ($line in $nmOutput) {
        if ($line -match '\s+T\s+(\w+)$') {
            $actualExports += $Matches[1]
        }
    }
    Write-Host "Total exported symbols: $($actualExports.Count)"
    Write-Host ""

    Write-Host "--- Checking expected functions ---"
    $found = 0
    $missing = @()
    foreach ($fn in $exports) {
        if ($actualExports -contains $fn) {
            $found++
        } else {
            $missing += $fn
        }
    }
    Write-Host "Found: $found / $exportCount"
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "MISSING:"
        $missing | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "All $exportCount expected functions are present in the DLL!"
    }
}

Write-Host ""
Write-Host "===== WASM Verification ====="
$wasmFile = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\sdk-core\_output\bin\openIM.wasm"
$wasmInfo = Get-Item $wasmFile
Write-Host "WASM Size: $([math]::Round($wasmInfo.Length/1MB,2)) MB"
Write-Host "WASM Date: $($wasmInfo.LastWriteTime)"
$wasmHeader = [System.IO.File]::ReadAllBytes($wasmFile)[0..3]
$isValid = ($wasmHeader[0] -eq 0x00 -and $wasmHeader[1] -eq 0x61 -and $wasmHeader[2] -eq 0x73 -and $wasmHeader[3] -eq 0x6D)
if ($isValid) {
    Write-Host "WASM magic bytes: OK (valid WebAssembly binary)"
} else {
    Write-Host "WASM magic bytes: INVALID!"
}
