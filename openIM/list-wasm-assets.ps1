$assetsPath = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\electron-client\app\node_modules\@openim\wasm-client-sdk\assets"
Get-ChildItem $assetsPath -Recurse -File | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "$($_.Name) - $sizeMB MB"
}
