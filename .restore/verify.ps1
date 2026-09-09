function Damage([string]$s){
  $b1=[Text.Encoding]::UTF8.GetBytes($s)
  $s932=[Text.Encoding]::GetEncoding(932).GetString($b1)
  $b2=[Text.Encoding]::GetEncoding(932).GetBytes($s932)
  $s3=[Text.Encoding]::UTF8.GetString($b2)
  return [Text.Encoding]::ASCII.GetString([Text.Encoding]::ASCII.GetBytes($s3))
}
$src=[IO.File]::ReadAllText("$PWD\.restore\App.damaged.jsx",[Text.Encoding]::ASCII)
$tests=@("'管轄店舗変更'","'設定'","'スタッフ情報 追加・変更'","'週間テンプレート作成'","'1週間の固定パターン'","'表示名・社員番号・担当店舗を選ぶ'")
$out=New-Object System.Collections.Generic.List[string]
foreach($t in $tests){
  $d=Damage $t
  $cnt=([regex]::Matches($src,[regex]::Escape($d))).Count
  $out.Add("$t => [$d] found=$cnt")
}
[IO.File]::WriteAllLines("$PWD\.restore\verify.txt",$out,[Text.UTF8Encoding]::new($false))
