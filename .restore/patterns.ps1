$ErrorActionPreference = "Stop"
$enc932 = [Text.Encoding]::GetEncoding(932)
function Damage([string]$s) {
  $b1 = [Text.Encoding]::UTF8.GetBytes($s)
  $s932 = $enc932.GetString($b1)
  $b2 = $enc932.GetBytes($s932)
  $s3 = [Text.Encoding]::UTF8.GetString($b2)
  return [Text.Encoding]::ASCII.GetString([Text.Encoding]::ASCII.GetBytes($s3))
}

$json = [IO.File]::ReadAllText("$PWD\.restore\cands.json", [Text.UTF8Encoding]::new($false))
$cands = $json | ConvertFrom-Json
$tails = @("", "'", '"', '`', ",", "<", ">", " ", "$", ")", "}", "]", ";", ":", "/", "=", ".", "!", "?", "+", "&", "|", "(", "[", "*", "-", "%", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "n", "s", "e", "t", "d", "y", "\n")
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("[")
$first = $true
foreach ($c in $cands) {
  foreach ($t in $tails) {
    $orig = $c + $t
    $d = Damage $orig
    if ($d.Length -lt 3) { continue }
    if (-not $first) { [void]$sb.Append(",") }
    $first = $false
    [void]$sb.Append((ConvertTo-Json @($orig, $d) -Compress))
  }
}
[void]$sb.Append("]")
[IO.File]::WriteAllText("$PWD\.restore\patterns.json", $sb.ToString(), [Text.UTF8Encoding]::new($false))
Write-Output "patterns written"
