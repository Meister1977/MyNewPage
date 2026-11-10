$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
# név -> (kimeneti mappa, oldal fájlneve). A webes nyitólap a /myhome/ alatt van, a gyökér a leíró oldalé.
$targets = @{
  extension = @{ Out = "dist\extension"; Page = "newtab.html" }
  web       = @{ Out = "dist\web\myhome"; Page = "index.html" }
}

foreach ($name in $targets.Keys) {
  $out = Join-Path $root $targets[$name].Out
  if (Test-Path $out) { Remove-Item $out -Recurse -Force }
  New-Item -ItemType Directory -Path $out -Force | Out-Null

  Copy-Item "$root\shared\*" $out -Recurse -Exclude "page.html"
  Copy-Item "$root\vendor\qrcode.js" $out
  Copy-Item "$root\platform\$name\*" $out -Recurse
  Copy-Item "$root\shared\page.html" (Join-Path $out $targets[$name].Page)
  Write-Host "Built $($targets[$name].Out)"
}

# A leíró weboldal (gyökér): dist\web\
Copy-Item "$root\site\*" (Join-Path $root "dist\web") -Recurse -Force
Write-Host "Built dist\web (site)"
