Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "C:\Users\yuyan\Desktop\123\market-data-downloader\openIM\1774956300612-openim-sdk-cpp-enterprise-v3.8.5-e-v1.1.11.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$prefix = ($zip.Entries[0].FullName -split '/')[0]
Write-Host "Root: $prefix"
Write-Host ""
$dirs = $zip.Entries | ForEach-Object {
    $rel = $_.FullName.Substring($prefix.Length + 1)
    $parts = $rel -split '/'
    if ($parts.Count -ge 1) { $parts[0] }
} | Sort-Object -Unique | Where-Object { $_ -ne '' }
Write-Host "Top-level entries:"
$dirs | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "export.go content:"
$entry = $zip.Entries | Where-Object { $_.FullName -match 'export\.go$' } | Select-Object -First 1
if ($entry) {
    $sr = New-Object System.IO.StreamReader($entry.Open())
    $content = $sr.ReadToEnd()
    $sr.Dispose()
    Write-Host $content.Substring(0, [Math]::Min(2000, $content.Length))
} else {
    Write-Host "(not found)"
}
$zip.Dispose()
