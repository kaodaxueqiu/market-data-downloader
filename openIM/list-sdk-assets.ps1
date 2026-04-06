$base = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\electron-client\app\node_modules\@openim\electron-client-sdk\assets"
Get-ChildItem $base -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($base.Length + 1)
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "$rel - $sizeMB MB"
}
