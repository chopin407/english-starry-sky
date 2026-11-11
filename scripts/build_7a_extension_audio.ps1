param(
    [string]$Voice = 'Microsoft Zira Desktop',
    [string]$Ffmpeg = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'
$atlas = Join-Path $PSScriptRoot '../public/atlas'
$manifest = Join-Path $PSScriptRoot '7a-extension-recordings.json'
$recordings = [ordered]@{}
if (Test-Path -LiteralPath $manifest) {
    $recordings = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifest | ConvertFrom-Json -AsHashtable
}
$index = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $atlas 'index.json') | ConvertFrom-Json
$extension = [Array]::IndexOf($index.cefr, '拓展词汇')
if ($extension -lt 0) { throw '请先导入七上拓展词汇。' }
$staging = Join-Path $PSScriptRoot 'build/extension-media'
New-Item -Path $staging -ItemType Directory -Force | Out-Null
$wav = Join-Path $staging 'voice.wav'
$mp3 = Join-Path $staging 'voice.mp3'

Add-Type -AssemblyName System.Speech
$speaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()

function Save-Recording([string]$Text, [string]$Path, [string]$Id) {
    $speaker.SetOutputToWaveFile($wav)
    try {
        if ($Id -eq 'tears' -and $Text -eq 'tears') {
            $speaker.SpeakSsml('<speak version="1.0" xml:lang="en-US" xmlns="http://www.w3.org/2001/10/synthesis"><phoneme alphabet="ipa" ph="tɪɹz">tears</phoneme></speak>')
        } else {
            $speaker.Speak($Text)
        }
    } finally {
        $speaker.SetOutputToNull()
    }
    & $Ffmpeg -v error -y -i $wav -af 'apad=pad_dur=0.2' -ac 1 -b:a 64k $mp3
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $Id" }
    Copy-Item -LiteralPath $mp3 -Destination $Path -Force
}

$written = 0
try {
    $speaker.SelectVoice($Voice)
    if ($speaker.Voice.Culture.Name -ne 'en-US') { throw '请选择 en-US 朗读声音。' }
    $speaker.Rate = -1
    $loaded = -1
    for ($i = 0; $i -lt $index.words.Count; $i++) {
        $row = $index.words[$i]
        if ($row[4] -ne $extension) { continue }
        $id = $row[0]
        $wordPath = Join-Path $atlas "audio/us/$id.mp3"
        if (-not ($row[6] -band 6) -and -not (Test-Path -LiteralPath $wordPath)) {
            Save-Recording $row[1] $wordPath $id
            $written++
        }
        $group = [int][Math]::Floor($i / $index.chunk)
        if ($group -ne $loaded) {
            $entries = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $atlas "entries/$group.json") | ConvertFrom-Json -NoEnumerate
            $loaded = $group
        }
        $example = $entries[$i % $index.chunk].ex[0].en
        $examplePath = Join-Path $atlas "audio/ex/$id.mp3"
        if ($example -and ((-not ($row[6] -band 8)) -or $recordings.Contains($id))) {
            if ($recordings[$id] -ne $example -or -not (Test-Path -LiteralPath $examplePath)) {
                Save-Recording $example $examplePath $id
                $recordings[$id] = $example
                $written++
            }
        }
    }
} finally {
    $speaker.Dispose()
    if ($recordings.Count) {
        $recordings | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $manifest
    }
}
Write-Output "生成录音 $written 段。"
