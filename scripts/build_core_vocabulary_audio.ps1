param(
    [string]$Voice = 'Microsoft Zira Desktop',
    [string]$Ffmpeg = 'ffmpeg',
    [string]$JobsPath = (Join-Path $PSScriptRoot 'build/core-audio-jobs.json')
)

$ErrorActionPreference = 'Stop'
$staging = Join-Path $PSScriptRoot 'build'
$jobs = Get-Content -Raw -Encoding utf8 -LiteralPath $JobsPath | ConvertFrom-Json -NoEnumerate
$wav = Join-Path $staging 'core-voice.wav'
$mp3 = Join-Path $staging 'core-voice.mp3'

Add-Type -AssemblyName System.Speech
$speaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $speaker.SelectVoice($Voice)
    if ($speaker.Voice.Culture.Name -ne 'en-US') { throw '请选择 en-US 朗读声音。' }
    $speaker.Rate = -1
    foreach ($job in $jobs) {
        $text, $target = $job
        $speaker.SetOutputToWaveFile($wav)
        try {
            $speaker.Speak($text)
        } finally {
            $speaker.SetOutputToNull()
        }
        & $Ffmpeg -v error -y -i $wav -af 'apad=pad_dur=0.2' -ac 1 -b:a 64k $mp3
        if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $target" }
        New-Item -Path (Split-Path $target -Parent) -ItemType Directory -Force | Out-Null
        Copy-Item -LiteralPath $mp3 -Destination $target
    }
} finally {
    $speaker.Dispose()
}
Write-Output "生成录音 $($jobs.Count) 段。"
