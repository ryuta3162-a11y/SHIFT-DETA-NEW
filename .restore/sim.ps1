$ErrorActionPreference="Stop"
$cases = @("'管轄店舗変更'", "'設定'", "['日', '月']", "'スタッフ情報 追加・変更'")
$sb = New-Object System.Text.StringBuilder
foreach($s in $cases){
  $u8 = [Text.Encoding]::UTF8.GetBytes($s)
  $dec932 = [Text.Encoding]::GetEncoding(932).GetString($u8)
  $out1252 = [Text.Encoding]::GetEncoding(1252).GetString([Text.Encoding]::GetEncoding(1252).GetBytes($dec932))
  $outAscii = [Text.Encoding]::ASCII.GetString([Text.Encoding]::ASCII.GetBytes($dec932))
  $decDef = [Text.Encoding]::Default.GetString($u8)
  $outDef = [Text.Encoding]::ASCII.GetString([Text.Encoding]::ASCII.GetBytes($decDef))
  [void]$sb.AppendLine("SRC   : $s")
  [void]$sb.AppendLine("932->1252: $out1252")
  [void]$sb.AppendLine("932->ascii: $outAscii")
  [void]$sb.AppendLine("default codepage: " + [Text.Encoding]::Default.CodePage + " -> $outDef")
  [void]$sb.AppendLine("")
}
[IO.File]::WriteAllText("$PWD\.restore\sim.txt", $sb.ToString(), [Text.UTF8Encoding]::new($false))
