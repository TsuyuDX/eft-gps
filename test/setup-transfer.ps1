$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$taskFixture=Join-Path (Get-Location) ('work\transfer-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskFixture -Force | Out-Null
$taskCompiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $taskCompiler /nologo /target:exe /main:TransferTest ("/out:"+(Join-Path $taskFixture 'TransferTest.exe')) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll scripts\NativeText.cs scripts\Maintenance.cs .github\native\DownloadSetup.cs .github\native\SetupTransfer.cs test\setup-transfer.cs
if($LASTEXITCODE -ne 0){throw 'Downloader test compilation failed'}
& (Join-Path $taskFixture 'TransferTest.exe') (Join-Path $taskFixture 'files')
if($LASTEXITCODE -ne 0){throw 'Downloader tests failed'}
