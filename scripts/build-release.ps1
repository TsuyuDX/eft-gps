$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
& runtime\node.exe scripts\release-manifest.mjs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось подготовить состав выпуска.' }
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /out:work\PackRelease.exe scripts\PackRelease.cs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать упаковщик.' }
$taskVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$taskOutput = Split-Path (Get-Location)
& work\PackRelease.exe (Get-Location).Path (Join-Path (Get-Location) 'work\release-input.json') (Join-Path $taskOutput "TarkovOffline-$taskVersion-Windows.zip") (Join-Path $taskOutput "TarkovOffline-$taskVersion-Setup.exe")
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать выпуск.' }
