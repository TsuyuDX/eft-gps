param([string]$Path,[switch]$Probe)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding $false
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]
$taskLanguages=@([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object LanguageTag)
if($Probe){@{languages=$taskLanguages;maxDimension=[Windows.Media.Ocr.OcrEngine]::MaxImageDimension} | ConvertTo-Json -Compress;exit}
$taskAwaitMethod=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
function Await-Operation($Operation,[Type]$ResultType){$taskWait=$taskAwaitMethod.MakeGenericMethod($ResultType).Invoke($null,@($Operation));if(-not $taskWait.Wait(15000)){throw 'OCR timeout'};return $taskWait.Result}
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$taskFile=Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
$taskStream=Await-Operation ($taskFile.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
try{
 $taskDecoder=Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($taskStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $taskTransform=New-Object Windows.Graphics.Imaging.BitmapTransform
 $taskScale=[Math]::Min(1,[Math]::Min(1920.0/$taskDecoder.PixelWidth,1080.0/$taskDecoder.PixelHeight))
 $taskTransform.ScaledWidth=[uint32]($taskDecoder.PixelWidth*$taskScale);$taskTransform.ScaledHeight=[uint32]($taskDecoder.PixelHeight*$taskScale)
 $taskBitmap=Await-Operation ($taskDecoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,[Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore,$taskTransform,[Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,[Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
 try{
  $taskLines=@();$taskUsed=@()
  foreach($taskLang in @('ru','en')){if(-not [Windows.Media.Ocr.OcrEngine]::IsLanguageSupported((New-Object Windows.Globalization.Language $taskLang))){continue};$taskEngine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language $taskLang));if($null -eq $taskEngine){continue};$taskResult=Await-Operation ($taskEngine.RecognizeAsync($taskBitmap)) ([Windows.Media.Ocr.OcrResult]);# Ignore peripheral HUD and quest lists; inspect the central interaction area only.
  foreach($taskLine in $taskResult.Lines){$taskBoxes=@($taskLine.Words | ForEach-Object {$_.BoundingRect});if(!$taskBoxes.Count){continue};$taskLeft=($taskBoxes | Measure-Object X -Minimum).Minimum;$taskRight=($taskBoxes | ForEach-Object {$_.X+$_.Width} | Measure-Object -Maximum).Maximum;$taskTop=($taskBoxes | Measure-Object Y -Minimum).Minimum;$taskBottom=($taskBoxes | ForEach-Object {$_.Y+$_.Height} | Measure-Object -Maximum).Maximum;$taskCenterX=($taskLeft+$taskRight)/2;$taskCenterY=($taskTop+$taskBottom)/2;if($taskCenterX -ge $taskTransform.ScaledWidth*0.15 -and $taskCenterX -le $taskTransform.ScaledWidth*0.85 -and $taskCenterY -ge $taskTransform.ScaledHeight*0.15 -and $taskCenterY -le $taskTransform.ScaledHeight*0.85){$taskLines+=$taskLine.Text}};$taskUsed+=$taskLang}
  @{lines=$taskLines;languages=$taskUsed} | ConvertTo-Json -Compress
 }finally{$taskBitmap.Dispose()}
}finally{$taskStream.Dispose()}
