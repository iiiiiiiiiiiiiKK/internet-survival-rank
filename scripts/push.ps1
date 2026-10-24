#!/usr/bin/env pwsh
# 用 GitHub Token 推送（不把 token 写进 .git/config）
param(
  [string]$Repo = 'iiiiiiiiiiiiiKK/internet-survival-rank',
  [string]$Branch = 'main',
  [string]$Message = 'chore: update'
)

$ErrorActionPreference = 'Stop'
$token = $env:GH_TOKEN
if (-not $token) { throw '请先设置环境变量 GH_TOKEN' }

git add -A
$staged = (git diff --cached --name-only | Measure-Object).Count
if ($staged -eq 0) { Write-Host '没有需要提交的改动'; exit 0 }

git commit -m $Message
$url = "https://x-access-token:$token@github.com/$Repo.git"
git -c http.sslBackend=openssl push $url "HEAD:$Branch"
Write-Host "已推送到 https://github.com/$Repo (分支 $Branch)"
