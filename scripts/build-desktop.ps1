$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$taskSdk = Join-Path (Get-Location) 'work\webview2-sdk\package'
if (!(Test-Path -LiteralPath "$taskSdk\lib\net462\Microsoft.Web.WebView2.Core.dll")) { throw 'Сначала загрузите официальный пакет Microsoft.Web.WebView2 1.0.4314.35 в work/webview2-sdk/package.' }
Copy-Item -LiteralPath "$taskSdk\lib\net462\Microsoft.Web.WebView2.Core.dll" -Destination runtime -Force
Copy-Item -LiteralPath "$taskSdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll" -Destination runtime -Force
Copy-Item -LiteralPath "$taskSdk\runtimes\win-x64\native\WebView2Loader.dll" -Destination runtime -Force
Copy-Item -LiteralPath "$taskSdk\LICENSE.txt" -Destination runtime\WEBVIEW2-LICENSE.txt -Force
$taskCompiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $taskCompiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll /reference:System.Drawing.dll /reference:runtime\Microsoft.Web.WebView2.Core.dll /reference:runtime\Microsoft.Web.WebView2.WinForms.dll /win32icon:public\icons\app.ico /out:runtime\TarkovDesktopHost.exe /resource:scripts\native.en.json,native.en.json scripts\NativeText.cs scripts\DesktopHost.cs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать оболочку.' }
& $taskCompiler /nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll /win32icon:public\icons\app.ico '/out:Tarkov Offline.exe' /resource:scripts\native.en.json,native.en.json scripts\NativeText.cs scripts\Launcher.cs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать запускатель.' }
& $taskCompiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /win32icon:public\icons\app.ico /resource:public\icons\app-192.png,installer-logo.png /out:runtime\TarkovMaintenance.exe /resource:scripts\native.en.json,native.en.json scripts\NativeText.cs scripts\Maintenance.cs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать установщик.' }

Copy-Item -LiteralPath "Tarkov Offline.exe" -Destination "Tarkov GPS.exe" -Force

Copy-Item -LiteralPath "Tarkov Offline.exe" -Destination "EFT GPS.exe" -Force
