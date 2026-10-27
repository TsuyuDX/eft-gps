param(
 [Parameter(Mandatory=$true)][string]$PartsManifest,
 [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path (Split-Path $PSScriptRoot)
$taskManifest=[IO.Path]::GetFullPath($PartsManifest)
$taskOutput=[IO.Path]::GetFullPath($Output)
if(!(Test-Path -LiteralPath $taskManifest)){throw 'A prepared setup-parts.json is required.'}
New-Item -ItemType Directory -Path (Split-Path $taskOutput) -Force | Out-Null
Push-Location -LiteralPath $taskRoot
try {
 $taskCompiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
 & $taskCompiler /nologo /target:winexe /platform:x64 /main:DownloadSetup /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /win32icon:public\icons\app.ico /resource:public\icons\app-192.png,installer-logo.png /resource:scripts\native.en.json,native.en.json ("/resource:$taskManifest,setup-parts.json") ("/out:$taskOutput") scripts\NativeText.cs scripts\Maintenance.cs tools\distribution\DownloadSetup.cs
 if($LASTEXITCODE -ne 0){throw 'Downloader compilation failed'}
 $taskTest=Start-Process -FilePath $taskOutput -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
 if($taskTest.ExitCode -ne 0){throw 'Downloader verification failed'}
 ((Get-FileHash -LiteralPath $taskOutput).Hash.ToLowerInvariant()+'  '+[IO.Path]::GetFileName($taskOutput)) | Set-Content -LiteralPath ($taskOutput+'.sha256') -Encoding ascii
} finally {Pop-Location}
