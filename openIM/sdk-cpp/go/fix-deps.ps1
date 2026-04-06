$env:GOPROXY = "https://goproxy.cn,direct"
$env:Path = "C:\Go\bin;" + $env:Path
Set-Location $PSScriptRoot
Write-Host "Tidying go modules..."
& C:\Go\bin\go.exe mod tidy
if ($LASTEXITCODE -ne 0) { throw "go mod tidy failed" }
Write-Host "Done!"
