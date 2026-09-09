$ErrorActionPreference="SilentlyContinue"
$src = "'" + [char]0x7BA1 + [char]0x8F44 + [char]0x5E97 + [char]0x8217 + [char]0x5909 + [char]0x66F4 + "'"
$target = "'??E???E??'"
$u8 = [Text.Encoding]::UTF8.GetBytes($src)
$lines = New-Object System.Collections.Generic.List[string]
$writeCPs = @(20127,1252,437,850,932,28591)
foreach($e in [Text.Encoding]::GetEncodings()){
  $rd = $null; try { $rd = [Text.Encoding]::GetEncoding($e.CodePage) } catch {}
  if(-not $rd){continue}
  $s1 = $null; try { $s1 = $rd.GetString($u8) } catch {}
  if(-not $s1){continue}
  foreach($w in $writeCPs){
    $we = $null; try { $we = [Text.Encoding]::GetEncoding($w) } catch {}
    if(-not $we){continue}
    $out = $null
    try { $out = [Text.Encoding]::ASCII.GetString([Text.Encoding]::ASCII.GetBytes($we.GetString($we.GetBytes($s1)))) } catch {}
    if($out -eq $target){ $lines.Add("MATCH read=$($e.CodePage) write=$w") }
  }
  # 参考: 読み側だけ変えて ASCII 直書き
  $o2 = $null
  try { $o2 = [Text.Encoding]::ASCII.GetString([Text.Encoding]::ASCII.GetBytes($s1)) } catch {}
  if($o2 -eq $target){ $lines.Add("MATCH read=$($e.CodePage) write=ascii-direct") }
  $lines.Add("read=$($e.CodePage) len=$($s1.Length) out=$o2")
}
[IO.File]::WriteAllLines("$PWD\.restore\brute.txt", $lines, [Text.UTF8Encoding]::new($false))
