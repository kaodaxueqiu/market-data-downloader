$newDll = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\sdk-cpp\go\_output\libopenimsdk.dll"
$headerFile = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\electron-client\app\extraResources\libopenimsdk.h"

$headerContent = Get-Content $headerFile -Raw
$expectedExports = [regex]::Matches($headerContent, 'extern\s+__declspec\(dllexport\)\s+\S+\s+(\w+)\(') | ForEach-Object { $_.Groups[1].Value }

$objdumpOutput = & C:\mingw64\bin\objdump.exe -p $newDll 2>&1 | Out-String
$actualExports = [regex]::Matches($objdumpOutput, '\[\s*\d+\]\s+\+base\[\s*\d+\]\s+[0-9a-f]+\s+(\w+)') | ForEach-Object { $_.Groups[1].Value }

Write-Host "===== DLL Export Verification ====="
Write-Host "Expected from header: $($expectedExports.Count) functions"
Write-Host "Actual in DLL:        $($actualExports.Count) functions"
Write-Host ""

$missing = $expectedExports | Where-Object { $_ -notin $actualExports }
$extra = $actualExports | Where-Object { $_ -notin $expectedExports }

if ($missing.Count -eq 0) {
    Write-Host "[PASS] All $($expectedExports.Count) expected functions found in DLL"
} else {
    Write-Host "[FAIL] Missing $($missing.Count) functions:"
    $missing | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ""
if ($extra.Count -gt 0) {
    Write-Host "[INFO] New DLL has $($extra.Count) additional functions (new features):"
    $extra | ForEach-Object { Write-Host "  + $_" }
}

Write-Host ""
Write-Host "===== WASM Verification ====="
$wasmFile = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\sdk-core\_output\bin\openIM.wasm"
$wasmInfo = Get-Item $wasmFile
Write-Host "Size: $([math]::Round($wasmInfo.Length/1MB,2)) MB"
$wasmHeader = [System.IO.File]::ReadAllBytes($wasmFile)[0..3]
$isValid = ($wasmHeader[0] -eq 0x00 -and $wasmHeader[1] -eq 0x61 -and $wasmHeader[2] -eq 0x73 -and $wasmHeader[3] -eq 0x6D)
Write-Host "Magic bytes: $(if($isValid){'PASS - valid WebAssembly'}else{'FAIL'})"

Write-Host ""
Write-Host "===== Summary ====="
$allPass = ($missing.Count -eq 0) -and $isValid
if ($allPass) {
    Write-Host "ALL CHECKS PASSED - Compiled SDK is compatible"
} else {
    Write-Host "SOME CHECKS FAILED"
}
