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
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:runtime\Microsoft.Web.WebView2.Core.dll /reference:runtime\Microsoft.Web.WebView2.WinForms.dll /win32icon:public\icons/app.ico /out:runtime\EFTGPSOverlay.exe /resource:scripts\native.en.json,native.en.json scripts\NativeText.cs scripts\OverlayHost.cs
if($LASTEXITCODE -ne 0){throw 'Overlay compilation failed.'}
Start-Process -FilePath (Join-Path (Get-Location) 'runtime\EFTGPSOverlay.exe') -ArgumentList '--preview-port 38479' -WorkingDirectory (Get-Location).Path
