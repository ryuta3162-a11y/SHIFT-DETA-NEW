$ErrorActionPreference = "Stop"
$enc932 = [Text.Encoding]::GetEncoding(932)
$utf8 = [Text.Encoding]::UTF8
$ascii = [Text.Encoding]::ASCII
function Damage([string]$s) {
  $s932 = $enc932.GetString($utf8.GetBytes($s))
  $s3 = $utf8.GetString($enc932.GetBytes($s932))
  return $ascii.GetString($ascii.GetBytes($s3))
}

$cands = [IO.File]::ReadAllText("$PWD\.restore\cands.json", [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
$leads = @("'", '"', '`', ">", " ", "(", "[", "{", ",", ":", "=", "}", "/", "*", "-", ".", "|", "&", "+", "n")
$tails = @("'", '"', '`', ",", "<", ">", " ", "$", ")", "}", "]", ";", ":", "/", "=", ".", "!", "+", "|", "&", "(", "[", "-", "n", "s", "e", "t", "0", "1", "2")
$sb = New-Object System.Text.StringBuilder
foreach ($c in $cands) {
  foreach ($l in $leads) {
    foreach ($t in $tails) {
      $orig = $l + $c + $t
      $d = Damage $orig
      [void]$sb.Append([Convert]::ToBase64String($utf8.GetBytes($orig)))
      [void]$sb.Append("`t")
      [void]$sb.Append([Convert]::ToBase64String($ascii.GetBytes($d)))
      [void]$sb.Append("`n")
    }
  }
}
[IO.File]::WriteAllText("$PWD\.restore\patterns2.txt", $sb.ToString(), [Text.UTF8Encoding]::new($false))
Write-Output "done"
