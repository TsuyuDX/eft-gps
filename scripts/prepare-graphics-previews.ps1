$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
Add-Type -AssemblyName System.Drawing
$taskPlan=Get-Content -LiteralPath 'work/gps-audit/preview-plan.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$taskFolder=Join-Path (Get-Location) 'public/assets/graphics-previews'
New-Item -ItemType Directory -Path $taskFolder -Force | Out-Null
$taskResult=@()
foreach($taskEntry in $taskPlan){
 if(!$taskEntry.input -or !(Test-Path -LiteralPath $taskEntry.input)){continue}
 $taskImage=[Drawing.Image]::FromFile($taskEntry.input)
 try{
  $taskScale=[Math]::Min([double]1,[Math]::Min([double]1600/$taskImage.Width,[double]900/$taskImage.Height))
  $taskWidth=[Math]::Max(1,[int]($taskImage.Width*$taskScale));$taskHeight=[Math]::Max(1,[int]($taskImage.Height*$taskScale))
  $taskBitmap=New-Object Drawing.Bitmap $taskWidth,$taskHeight
  try{
   $taskGraphics=[Drawing.Graphics]::FromImage($taskBitmap)
   try{$taskGraphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$taskGraphics.DrawImage($taskImage,0,0,$taskWidth,$taskHeight)}finally{$taskGraphics.Dispose()}
   $taskEncoder=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
   $taskParameters=New-Object Drawing.Imaging.EncoderParameters 1
   $taskParameters.Param[0]=New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality),([long]88)
   try{$taskBitmap.Save((Join-Path $taskFolder ($taskEntry.slug+'.jpg')),$taskEncoder,$taskParameters)}finally{$taskParameters.Dispose()}
   $taskResult+=@{id=('sample-'+$taskEntry.slug);location=$taskEntry.location;url=('/assets/graphics-previews/'+$taskEntry.slug+'.jpg');width=$taskWidth;height=$taskHeight;readonly=$true;kind=$taskEntry.kind;source=$taskEntry.source}
  }finally{$taskBitmap.Dispose()}
 }finally{$taskImage.Dispose()}
}
ConvertTo-Json -InputObject @($taskResult) -Depth 4 | Set-Content -LiteralPath 'public/data/graphics-previews.json' -Encoding utf8
Write-Output ('Prepared '+$taskResult.Count+' location previews; original captures unchanged.')
