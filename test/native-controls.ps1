$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
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

$taskLocale=$taskAssembly.GetType('NativeText')
$taskLocale.GetField('English').SetValue($null,$true)
$taskTranslated=$taskLocale.GetMethod('T').Invoke($null,@('Установить'))
if($taskTranslated -ne 'Install'){throw ('Native English translation failed: '+$taskTranslated)}
Write-Output 'Embedded native English translations load successfully in .NET Framework.'
