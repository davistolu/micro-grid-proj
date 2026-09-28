Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\..\public\apple-icon.png"
$buildDir = Join-Path $PSScriptRoot "..\build"
$icoPath = Join-Path $buildDir "icon.ico"
$pngPath = Join-Path $buildDir "icon.png"

Write-Host "Generating desktop app icons from $sourcePath..."

$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

# Save 256x256 PNG
$pngBitmap = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($pngBitmap)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($srcImg, 0, 0, 256, 256)
$g.Dispose()

$pngBitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBitmap.Dispose()

# Create multi-size ICO: 16, 32, 48, 64, 128, 256
$sizes = @(16, 32, 48, 64, 128, 256)
$imagesData = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($srcImg, 0, 0, $size, $size)
    $graphics.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()

    $imagesData += ,@($size, $bytes)
}
$srcImg.Dispose()

# Write ICO file binary
$fs = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR: idReserved (0), idType (1), idCount
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$imagesData.Count)

$offset = 6 + ($imagesData.Count * 16)

# Write entries
foreach ($entry in $imagesData) {
    $size = $entry[0]
    $bytes = $entry[1]

    $w = if ($size -ge 256) { 0 } else { [byte]$size }
    $h = if ($size -ge 256) { 0 } else { [byte]$size }

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0) # colorCount
    $bw.Write([byte]0) # reserved
    $bw.Write([uint16]1) # planes
    $bw.Write([uint16]32) # bpp
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)

    $offset += $bytes.Length
}

# Write image data
foreach ($entry in $imagesData) {
    $bytes = $entry[1]
    $bw.Write($bytes)
}

$bw.Close()
$fs.Close()

Write-Host "Successfully generated icon.ico and icon.png at $buildDir"
