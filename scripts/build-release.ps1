$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
& runtime\node.exe scripts\prepare-portable.mjs --assemble-component
if ($LASTEXITCODE -ne 0) { throw 'Offline runtime preparation failed.' }
& runtime\node.exe scripts\release-manifest.mjs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось подготовить состав выпуска.' }
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /out:work\PackRelease.exe scripts\PackRelease.cs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать упаковщик.' }
$taskVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$taskOutput = Join-Path (Split-Path (Get-Location)) "Releases\$taskVersion"
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
& work\PackRelease.exe (Get-Location).Path (Join-Path (Get-Location) 'work\release-input.json') (Join-Path $taskOutput "TSUYU-EFTGPS-$taskVersion-Windows.zip") (Join-Path $taskOutput "TSUYU-EFTGPS-$taskVersion-Setup.exe")
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать выпуск.' }

# Upload this manifest and all parts together before marking the GitHub release Latest.
$taskUpdateOutput = Join-Path $taskOutput 'AutoUpdate'
& runtime\node.exe scripts\build-app-update.mjs (Join-Path $taskOutput "TSUYU-EFTGPS-$taskVersion-Windows.zip") $taskUpdateOutput $taskVersion
if ($LASTEXITCODE -ne 0) { throw 'Auto-update package generation failed.' }
