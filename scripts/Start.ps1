param([ValidateRange(1024, 65535)][int]$Port = 5080)

$ErrorActionPreference = 'Stop'
$localDotnet = Join-Path $env:LOCALAPPDATA 'TaskLab\dotnet\dotnet.exe'
$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue

if (Test-Path $localDotnet) {
    $dotnet = $localDotnet
} elseif ($dotnetCommand) {
    $dotnet = $dotnetCommand.Source
} else {
    throw 'Install the .NET 10 SDK from https://dotnet.microsoft.com/download/dotnet/10.0 and reopen your terminal.'
}

$listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
while ($listeners.Port -contains $Port) {
    if ($Port -eq 65535) { throw 'No available port. Choose another port with -Port.' }
    $Port++
}

Write-Host "Starting TaskLab at http://localhost:$Port" -ForegroundColor Green
& $dotnet run --project (Join-Path $PSScriptRoot '..\TaskLab.csproj') --urls "http://localhost:$Port"
exit $LASTEXITCODE