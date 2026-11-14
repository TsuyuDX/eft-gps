param([switch]$EmbeddedOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskOutput = Join-Path $taskRoot ('work\overlay-check-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
Copy-Item runtime\Microsoft.Web.WebView2*.dll -Destination $taskOutput
$taskCompiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$taskReferences = @('/nologo','/target:exe','/platform:x64','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll','/reference:System.Drawing.dll','/reference:runtime\Microsoft.Web.WebView2.Core.dll','/reference:runtime\Microsoft.Web.WebView2.WinForms.dll')
& $taskCompiler @taskReferences /main:EmbeddedOverlayTest ("/out:" + (Join-Path $taskOutput 'embedded.exe')) scripts\NativeText.cs scripts\OverlayHost.cs test\embedded-overlay.cs
if ($LASTEXITCODE -ne 0) { throw 'Embedded Overlay compilation failed.' }
& (Join-Path $taskOutput 'embedded.exe') $taskRoot
if ($LASTEXITCODE -ne 0) { throw 'Embedded Overlay checks failed.' }
if (!$EmbeddedOnly) {
    & $taskCompiler @taskReferences /main:OverlayNativeTest ("/out:" + (Join-Path $taskOutput 'window.exe')) scripts\NativeText.cs scripts\OverlayHost.cs test\overlay-native.cs
    if ($LASTEXITCODE -ne 0) { throw 'Overlay window compilation failed.' }
    & (Join-Path $taskOutput 'window.exe')
    if ($LASTEXITCODE -ne 0) { throw 'Overlay window checks failed.' }
}
