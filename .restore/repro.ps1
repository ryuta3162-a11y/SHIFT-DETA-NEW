$dir="$PWD\.restore\t"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$orig = "const A = { work: '出勤', off: '公休' };`r`nconst B = '管轄店舗変更';`r`nconst C = '設定';`r`n"
[IO.File]::WriteAllText("$dir\a.jsx", $orig, [Text.UTF8Encoding]::new($false))
# 当時と同じ操作を再現
$t = Get-Content -Raw "$dir\a.jsx"
$t = $t -replace 'const A', 'const A'
Set-Content -Path "$dir\a.jsx" -Value $t
$bytes=[IO.File]::ReadAllBytes("$dir\a.jsx")
$asc = -join ($bytes | ForEach-Object { if($_ -ge 32 -and $_ -lt 127){[char]$_} elseif($_ -eq 10){"\n"} elseif($_ -eq 13){""} else {"<$_>"} })
[IO.File]::WriteAllText("$PWD\.restore\repro.txt", $asc, [Text.UTF8Encoding]::new($false))
