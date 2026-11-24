$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$taskOutput=Join-Path (Get-Location) ('work/item-notice-test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
Copy-Item runtime/Microsoft.Web.WebView2*.dll -Destination $taskOutput
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /main:ItemNoticeTest /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:runtime/Microsoft.Web.WebView2.Core.dll /reference:runtime/Microsoft.Web.WebView2.WinForms.dll ('/out:'+(Join-Path $taskOutput 'test.exe')) scripts\NativeText.cs scripts\DesktopHost.cs scripts\OverlayHost.cs test\item-notice.cs
if($LASTEXITCODE -ne 0){throw 'Native notice test build failed'}
$taskProcess=Start-Process -FilePath (Join-Path $taskOutput 'test.exe') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $taskOutput 'result.txt') -RedirectStandardError (Join-Path $taskOutput 'error.txt')
if($taskProcess.ExitCode -ne 0){throw ('Native notice test failed: '+[IO.File]::ReadAllText((Join-Path $taskOutput 'error.txt')))}
Get-Content -LiteralPath (Join-Path $taskOutput 'result.txt')
