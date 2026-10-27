$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskFixture = Join-Path (Get-Location) ('work\installer-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskFixture -Force | Out-Null
function New-TestPackage([string]$tag, [string]$text, [bool]$tamper = $false, [bool]$traversal = $false) {
  $taskSource = Join-Path $taskFixture $tag
  New-Item -ItemType Directory -Path (Join-Path $taskSource 'public') -Force | Out-Null
  $taskFiles = @()
  foreach ($taskRelative in @('public/index.html','server.mjs','Tarkov Offline.exe',('public/data/articles/' + ('very-long-quest-name-' * 8) + '.json'))) {
    $taskPath = Join-Path $taskSource $taskRelative
    [IO.Directory]::CreateDirectory(('\\?\' + (Split-Path $taskPath))) | Out-Null
    [IO.File]::WriteAllText(('\\?\' + $taskPath), $text)
    $taskFiles += @{path=$taskRelative;size=(Get-Item -LiteralPath $taskPath).Length;sha256=(Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant()}
  }
  @{format=1;app='TarkovOffline';version='1.4.0';files=$taskFiles} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskSource 'release.json') -Encoding utf8
  if ($tamper) { [IO.File]::WriteAllText((Join-Path $taskSource 'public/index.html'), 'tampered') }
  $taskZip = Join-Path $taskFixture ($tag + '.zip')
  [IO.Compression.ZipFile]::CreateFromDirectory($taskSource,$taskZip)
  if ($traversal) {
    $taskArchive=[IO.Compression.ZipFile]::Open($taskZip,[IO.Compression.ZipArchiveMode]::Update)
    $taskEntry=$taskArchive.CreateEntry('../userdata/profile.json')
    $taskWriter=New-Object IO.StreamWriter($taskEntry.Open());$taskWriter.Write('bad');$taskWriter.Dispose();$taskArchive.Dispose()
  }
  return $taskZip
}
function Invoke-TestInstall([string]$zip,[string]$target) {
  $taskExecutable=Join-Path (Get-Location) 'runtime\TarkovMaintenance.exe'
  $taskArgs='--test-install "' + $zip + '" "' + $target + '"'
  $taskProcess=Start-Process -FilePath $taskExecutable -ArgumentList $taskArgs -WindowStyle Hidden -PassThru -Wait
  return $taskProcess.ExitCode
}
$taskTarget=Join-Path $taskFixture 'target'
$taskFirst=New-TestPackage 'first' 'old version'
if ((Invoke-TestInstall $taskFirst $taskTarget) -ne 0) { throw 'First installation failed' }
New-Item -ItemType Directory -Path (Join-Path $taskTarget 'userdata') -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $taskTarget 'userdata\profile.json'),'keep my progress')
$taskNext=New-TestPackage 'next' 'new version'
if ((Invoke-TestInstall $taskNext $taskTarget) -ne 0) { throw 'Update failed' }
if ([IO.File]::ReadAllText((Join-Path $taskTarget 'public\index.html')) -ne 'new version') { throw 'Update did not apply' }
$taskLongFile=Join-Path $taskTarget ('public/data/articles/' + ('very-long-quest-name-' * 8) + '.json')
if ($taskLongFile.Length -lt 260 -or [IO.File]::ReadAllText(('\\?\' + $taskLongFile)) -ne 'new version') { throw 'Long path installation failed' }
if ([IO.File]::ReadAllText((Join-Path $taskTarget 'userdata\profile.json')) -ne 'keep my progress') { throw 'Progress was changed' }
$taskBad=New-TestPackage 'tampered' 'bad version' $true
if ((Invoke-TestInstall $taskBad $taskTarget) -eq 0) { throw 'Tampered package was accepted' }
if ([IO.File]::ReadAllText((Join-Path $taskTarget 'public\index.html')) -ne 'new version') { throw 'Tampered package changed files' }
$taskTraversal=New-TestPackage 'traversal' 'bad version' $false $true
if ((Invoke-TestInstall $taskTraversal $taskTarget) -eq 0) { throw 'Traversal package was accepted' }
$taskLocked=[IO.File]::Open((Join-Path $taskTarget 'Tarkov Offline.exe'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try { if ((Invoke-TestInstall $taskFirst $taskTarget) -eq 0) { throw 'Locked target was not rejected' } } finally { $taskLocked.Dispose() }
if ([IO.File]::ReadAllText((Join-Path $taskTarget 'public\index.html')) -ne 'new version') { throw 'Rollback did not restore the interface' }
if ([IO.File]::ReadAllText((Join-Path $taskTarget 'server.mjs')) -ne 'new version') { throw 'Rollback did not restore the server' }
'Installer checks passed: new install, update, progress preservation, tamper rejection, traversal rejection, rollback on locked file.'

# Verify prerequisites and the custom log scrollbar without touching system components.
$taskAssembly=[Reflection.Assembly]::LoadFile((Join-Path (Get-Location) 'runtime\TarkovMaintenance.exe'))
$taskFlags=[Reflection.BindingFlags]'NonPublic,Static'
$taskMaintenance=$taskAssembly.GetType('Maintenance')
$taskMaintenance.GetMethod('CheckPlatform',$taskFlags).Invoke($null,@()) | Out-Null
if (!$taskMaintenance.GetMethod('RuntimeVersion',$taskFlags).Invoke($null,@())) { throw 'Installed WebView2 was not detected' }
Add-Type -AssemblyName System.Windows.Forms
$taskLog=[Activator]::CreateInstance($taskAssembly.GetType('DarkLog'))
try {
  $taskLog.Size=New-Object Drawing.Size(500,90)
  $taskLog.CreateControl()
  $taskLog.AppendText((1..150 | ForEach-Object {"Line $_`r`n"}) -join '')
  $taskPrivate=[Reflection.BindingFlags]'NonPublic,Instance'
  $taskFirst=$taskLog.GetType().GetProperty('First',$taskPrivate)
  $taskScroll=$taskLog.GetType().GetMethod('ScrollTo',$taskPrivate)
  if ($taskFirst.GetValue($taskLog) -le 0) { throw 'Log did not scroll to latest line' }
  $taskScroll.Invoke($taskLog,@(0)) | Out-Null
  if ($taskFirst.GetValue($taskLog) -ne 0) { throw 'Custom scrollbar did not return to beginning' }
  $taskScroll.Invoke($taskLog,@(100000)) | Out-Null
  if ($taskFirst.GetValue($taskLog) -le 0) { throw 'Custom scrollbar could not reach end' }
} finally { $taskLog.Dispose() }
Write-Output 'Prerequisites detected; custom dark log scrolls to beginning and end.'
