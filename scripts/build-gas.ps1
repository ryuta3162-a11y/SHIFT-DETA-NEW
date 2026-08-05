# GAS 用 index.html をビルドして docs/gas/deployed/ にコピー
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "プロジェクト: $root" -ForegroundColor Cyan

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    $cursorNode = Join-Path $env:LOCALAPPDATA "Programs\cursor\resources\app\resources\helpers\node.exe"
    if (Test-Path $cursorNode) {
        $env:Path = (Split-Path $cursorNode -Parent) + ";" + $env:Path
        Write-Host "システムの Node が無いため Cursor 同梱 Node を使用します" -ForegroundColor Yellow
    } else {
        Write-Host "Node.js が見つかりません。" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Node: $(node -v)  npm: $(npm -v)" -ForegroundColor Green

if (-not (Test-Path "node_modules")) {
    Write-Host "初回: npm install を実行します..." -ForegroundColor Cyan
    npm install
}

Write-Host "ビルド中..." -ForegroundColor Cyan
npm run build

$src = Join-Path $root "dist\index.html"
$dst = Join-Path $root "docs\gas\deployed\index.html"
if (-not (Test-Path $src)) {
    Write-Host "dist\index.html ができませんでした。" -ForegroundColor Red
    exit 1
}

Copy-Item -Force $src $dst
$size = (Get-Item $dst).Length
Write-Host ""
Write-Host "完了: docs\gas\deployed\index.html ($size bytes)" -ForegroundColor Green
Write-Host "次: GAS の index に貼り付け → Code.gs も deployed/Code.gs を貼る → 新バージョンでデプロイ" -ForegroundColor Cyan
