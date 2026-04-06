Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $PSScriptRoot "1774956055520-open-im-sdk-core-enterprise-v3.8.5-e-v1.1.11.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$prefix = "openimsdk-open-im-sdk-core-enterprise-50e88fa033ba83cb8e552071e7456132eef0e0c1"

$filesToRead = @("Makefile", ".goreleaser.yaml", "go.mod", "wasm/cmd/Makefile")
foreach ($name in $filesToRead) {
    $entry = $zip.GetEntry("$prefix/$name")
    if ($entry) {
        Write-Host "===== $name ====="
        $sr = New-Object System.IO.StreamReader($entry.Open())
        Write-Host $sr.ReadToEnd()
        $sr.Dispose()
        Write-Host ""
    }
}
$zip.Dispose()
