$src = "'" + [char]0x7BA1 + [char]0x8F44 + [char]0x5E97 + [char]0x8217 + [char]0x5909 + [char]0x66F4 + "'"
$u8 = [Text.Encoding]::UTF8.GetBytes($src)
$lines = New-Object System.Collections.Generic.List[string]
foreach($cp in @(936,949,950,1361,10002,20001,20003,20005,50227,51936,54936,932,20932,50220,50221)){
  $rd=$null; try{$rd=[Text.Encoding]::GetEncoding($cp)}catch{}
  if(-not $rd){continue}
  $s1=$rd.GetString($u8)
  $cps = ($s1.ToCharArray() | ForEach-Object { "U+{0:X4}" -f [int]$_ }) -join " "
  $lines.Add("read=$cp len=$($s1.Length)")
  $lines.Add("  chars: $cps")
  foreach($w in @(20127,1252,437,850,10000,28591)){
    $we=$null; try{$we=[Text.Encoding]::GetEncoding($w)}catch{}
    if(-not $we){continue}
    $bytes=$we.GetBytes($s1)
    $asAscii = -join ($bytes | ForEach-Object { if($_ -ge 32 -and $_ -lt 127){[char]$_}else{"<$_>"} })
    $lines.Add("  write=$w -> $asAscii")
  }
}
[IO.File]::WriteAllLines("$PWD\.restore\brute2.txt", $lines, [Text.UTF8Encoding]::new($false))
