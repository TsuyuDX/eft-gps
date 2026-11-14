$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$taskOrigin='http://127.0.0.1:38479'
$taskHasher=[Security.Cryptography.SHA256]::Create()
try {$taskInstance=([BitConverter]::ToString($taskHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes((Get-Location).Path.ToLowerInvariant())))).Replace('-','').ToLowerInvariant()} finally {$taskHasher.Dispose()}
try {$taskHealth=Invoke-RestMethod ($taskOrigin+'/api/health') -TimeoutSec 2} catch {$taskHealth=$null}
if($taskHealth -and $taskHealth.instance -ne $taskInstance){throw 'Preview port belongs to another application.'}
if(!$taskHealth){
 $env:PORT='38479';$env:EFTGPS_PREVIEW='1';$env:EFTGPS_NO_EVENT_NETWORK='1'
 Start-Process -FilePath (Join-Path (Get-Location) 'runtime\node.exe') -ArgumentList 'server.mjs --desktop' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden
 for($taskWait=0;$taskWait -lt 30;$taskWait++){try{$taskHealth=Invoke-RestMethod ($taskOrigin+'/api/health') -TimeoutSec 1;break}catch{Start-Sleep -Milliseconds 200}}
 if(!$taskHealth -or $taskHealth.instance -ne $taskInstance){throw 'Preview service did not start.'}
}
& .\scripts\build-desktop.ps1
if($LASTEXITCODE -ne 0){throw 'Desktop compilation failed.'}
# The test uses the main application too. Enable Overlay in Settings → Overlay.
Start-Process -FilePath (Join-Path (Get-Location) 'runtime\TarkovDesktopHost.exe') -ArgumentList '--preview-port 38479' -WorkingDirectory (Get-Location).Path
