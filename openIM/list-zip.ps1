Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $PSScriptRoot "1774956055520-open-im-sdk-core-enterprise-v3.8.5-e-v1.1.11.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$prefix = $zip.Entries[0].FullName -replace '/.*',''
$dirs = $zip.Entries | ForEach-Object {
    $rel = $_.FullName.Substring($prefix.Length + 1)
    $parts = $rel -split '/'
    if ($parts.Count -ge 1) { $parts[0] }
} | Sort-Object -Unique | Where-Object { $_ -ne '' }
Write-Host "Root: $prefix"
Write-Host ""
Write-Host "Top-level entries:"
$dirs | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Build-related files:"
$zip.Entries | Where-Object { $_.FullName -match '(Makefile|goreleaser|wasm|cmd/|/main\.go|build/)' -and $_.FullName -notmatch 'integration_test' } | ForEach-Object { Write-Host "  $($_.FullName.Substring($prefix.Length + 1))" }
$zip.Dispose()
