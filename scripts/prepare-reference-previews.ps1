param([string]$Plan='work/reference-previews/plan.json')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
Add-Type -AssemblyName System.Drawing
$taskPlan=Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$taskFolder=Join-Path (Get-Location) 'public/assets/graphics-previews'
New-Item -ItemType Directory -Path $taskFolder -Force | Out-Null
$taskResults=@()
foreach($taskRow in $taskPlan){
 $taskImage=[Drawing.Image]::FromFile($taskRow.input)
 try{
  $taskScale=[Math]::Min([double]1,[Math]::Min([double]1600/$taskImage.Width,[double]900/$taskImage.Height))
  $taskWidth=[int]($taskImage.Width*$taskScale);$taskHeight=[int]($taskImage.Height*$taskScale)
  $taskBitmap=New-Object Drawing.Bitmap $taskWidth,$taskHeight
  try{
   $taskDraw=[Drawing.Graphics]::FromImage($taskBitmap)
   try{$taskDraw.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$taskDraw.DrawImage($taskImage,0,0,$taskWidth,$taskHeight)}finally{$taskDraw.Dispose()}
   $taskEncoder=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
   $taskParams=New-Object Drawing.Imaging.EncoderParameters 1
   $taskParams.Param[0]=New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality),([long]84)
   try{$taskBitmap.Save((Join-Path $taskFolder ($taskRow.slug+'.jpg')),$taskEncoder,$taskParams)}finally{$taskParams.Dispose()}
   $taskResults+=@{id=('reference-'+$taskRow.slug);slug=$taskRow.slug;location=$taskRow.location;url=('/assets/graphics-previews/'+$taskRow.slug+'.jpg');width=$taskWidth;height=$taskHeight;readonly=$true;kind='game-screenshot';source='Escape from Tarkov Wiki · gameplay showcase';sourceUrl=$taskRow.source;copyright='Game imagery © Battlestate Games. Reference: Escape from Tarkov Wiki.'}
  }finally{$taskBitmap.Dispose()}
 }finally{$taskImage.Dispose()}
}
foreach($taskAlias in @(@('night-factory','factory','Ночной Завод'),@('ground-zero-21','ground-zero','Эпицентр 21+'))){$taskOriginal=$taskResults | Where-Object slug -eq $taskAlias[1];$taskCopy=$taskOriginal.Clone();$taskCopy.id='reference-'+$taskAlias[0];$taskCopy.slug=$taskAlias[0];$taskCopy.location=$taskAlias[2];$taskResults+=$taskCopy}
$taskResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath 'public/data/graphics-previews.json' -Encoding UTF8
