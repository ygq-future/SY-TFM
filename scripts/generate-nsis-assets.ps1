param(
  [string]$IconPath = "assets/branding/app-icon.png",
  [string]$OutputDirectory = "src-tauri/installer-assets"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-GradientBrush([System.Drawing.Rectangle]$Bounds, [System.Drawing.Color]$Start, [System.Drawing.Color]$End) {
  return [System.Drawing.Drawing2D.LinearGradientBrush]::new($Bounds, $Start, $End, 25.0)
}

function Save-InstallerArt([int]$Width, [int]$Height, [string]$Destination, [bool]$ShowTitle) {
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $bounds = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $background = New-GradientBrush $bounds ([System.Drawing.Color]::FromArgb(14, 22, 39)) ([System.Drawing.Color]::FromArgb(34, 49, 75))
  $graphics.FillRectangle($background, $bounds)

  $glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(54, 255, 120, 64))
  $graphics.FillEllipse($glowBrush, [System.Drawing.Rectangle]::new([int]($Width * 0.32), [int]($Height * 0.18), [int]($Width * 0.9), [int]($Height * 0.72)))
  $glowBrush.Dispose()

  $icon = [System.Drawing.Image]::FromFile((Resolve-Path $IconPath))
  $iconSize = if ($ShowTitle) { [Math]::Min(72, [int]($Height * 0.27)) } else { [Math]::Min(42, [int]($Height * 0.74)) }
  $iconX = if ($ShowTitle) { [int](($Width - $iconSize) / 2) } else { 12 }
  $iconY = if ($ShowTitle) { [int]($Height * 0.10) } else { [int](($Height - $iconSize) / 2) }
  $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new($iconX, $iconY, $iconSize, $iconSize))
  $icon.Dispose()

  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(247, 249, 255))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(183, 199, 226))
  if ($ShowTitle) {
    $titleFont = [System.Drawing.Font]::new("Segoe UI Semibold", 18, [System.Drawing.FontStyle]::Regular)
    $bodyFont = [System.Drawing.Font]::new("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)
    $titleFormat = [System.Drawing.StringFormat]::new()
    $titleFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString("SY-TFM", $titleFont, $white, [System.Drawing.RectangleF]::new(0, [float]($iconY + $iconSize + 12), $Width, 28), $titleFormat)
    $graphics.DrawString("TINY FILE MANAGER", $bodyFont, $muted, [System.Drawing.RectangleF]::new(0, [float]($iconY + $iconSize + 42), $Width, 18), $titleFormat)
    $titleFormat.Dispose(); $titleFont.Dispose(); $bodyFont.Dispose()
  } else {
    $titleFont = [System.Drawing.Font]::new("Segoe UI Semibold", 11, [System.Drawing.FontStyle]::Regular)
    $graphics.DrawString("SY-TFM", $titleFont, $white, 62, [int](($Height - 22) / 2))
    $titleFont.Dispose()
  }
  $white.Dispose(); $muted.Dispose(); $background.Dispose(); $graphics.Dispose()
  $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Save-InstallerArt 150 57 (Join-Path $OutputDirectory "header.bmp") $false
Save-InstallerArt 164 314 (Join-Path $OutputDirectory "sidebar.bmp") $true
