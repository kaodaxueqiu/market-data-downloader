$oldWasm = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\electron-client\app\node_modules\@openim\wasm-client-sdk\assets\openIM.wasm"
$newWasm = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\sdk-core\_output\bin\openIM.wasm"

$oldInfo = Get-Item $oldWasm
$newInfo = Get-Item $newWasm
Write-Host "Old WASM: $([math]::Round($oldInfo.Length/1MB,2)) MB  ($($oldInfo.LastWriteTime))"
Write-Host "New WASM: $([math]::Round($newInfo.Length/1MB,2)) MB  ($($newInfo.LastWriteTime))"
Write-Host ""

Copy-Item $newWasm $oldWasm -Force
Write-Host "Replaced!"
