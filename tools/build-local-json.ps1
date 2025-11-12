param(
    [Parameter(Mandatory = $true)]
    [string]$InputCsv,     # 예: .\Korea_Q1.csv

    [Parameter(Mandatory = $true)]
    [string]$OutputJson,   # 예: .\assets\seed\korea-q1.json

    [Parameter(Mandatory = $true)]
    [ValidateSet("korea","japan","world")]
    [string]$Country,      # korea / japan / world

    [Parameter(Mandatory = $true)]
    [ValidateSet("Q1","Q2","Q3","Q4")]
    [string]$Quarter       # Q1 ~ Q4
)

# ---- 시트 컬럼 이름 ----
$ColDate = "Date"
$ColYear = "Year"

$ColEn = "English"
$ColKo = "한국어"
$ColJa = "日本語"

# Anchor 컬럼 이름들
$AnchorCols = @{
    en = @(
        @{ Text = "Anchor_text1_english"; Url = "URL1_english" },
        @{ Text = "Anchor_text2_english"; Url = "URL2_english" }
    )
    ko = @(
        @{ Text = "Anchor_text1_korean";  Url = "URL1_korean"  },
        @{ Text = "Anchor_text2_korean";  Url = "URL2_korean"  }
    )
    ja = @(
        @{ Text = "Anchor_text1_japanese"; Url = "URL1_japanese" },
        @{ Text = "Anchor_text2_japanese"; Url = "URL2_japanese" }
    )
}

function Get-Value {
    param(
        [pscustomobject]$Row,
        [string]$Name
    )
    if ($Row.PSObject.Properties.Name -contains $Name) {
        $v = $Row.$Name
        if ($null -ne $v -and "$v".Trim() -ne "") {
            return "$v".Trim()
        }
    }
    return $null
}

function Get-DCodeFromDate {
    param(
        [pscustomobject]$Row
    )
    $dateStr = Get-Value -Row $Row -Name $ColDate
    if (-not $dateStr) { return $null }

    $dateStr = "$dateStr".PadLeft(4, "0")
    $mm = $dateStr.Substring(0, 2)
    $dd = $dateStr.Substring(2, 2)

    if (-not ($mm -match '^\d{2}$' -and $dd -match '^\d{2}$')) {
        return $null
    }

    return "D{0}{1}" -f $mm, $dd
}

function Get-AnchorsFromRow {
    param(
        [pscustomobject]$Row,
        [string]$LangKey  # en / ko / ja
    )
    $result = @()

    foreach ($pair in $AnchorCols[$LangKey]) {
        $textCol = $pair.Text
        $urlCol  = $pair.Url

        $textVal = $null
        $urlVal  = $null

        if ($Row.PSObject.Properties.Name -contains $textCol) {
            $textVal = "$($Row.$textCol)".Trim()
        }
        if ($Row.PSObject.Properties.Name -contains $urlCol) {
            $urlVal = "$($Row.$urlCol)".Trim()
        }

        if ($textVal -and $textVal -ne "#VALUE!" -and $urlVal) {
            $result += [pscustomobject]@{
                text = $textVal
                url  = $urlVal
            }
        }
    }

    return $result
}

# ---------------- 메인 ----------------

if (-not (Test-Path $InputCsv)) {
    Write-Error "Input CSV not found: $InputCsv"
    exit 1
}

$rows = Import-Csv -Path $InputCsv -Encoding UTF8
$daysMap = @{}

foreach ($row in $rows) {
    $dcode = Get-DCodeFromDate -Row $row
    if (-not $dcode) { continue }

    $yearVal = Get-Value -Row $row -Name $ColYear
    $enVal   = Get-Value -Row $row -Name $ColEn
    $koVal   = Get-Value -Row $row -Name $ColKo
    $jaVal   = Get-Value -Row $row -Name $ColJa

    if (-not $yearVal -and -not $enVal -and -not $koVal -and -not $jaVal) {
        continue
    }

    $yearStr = if ($yearVal) { "$yearVal" } else { $null }

    $enAnchors = Get-AnchorsFromRow -Row $row -LangKey "en"
    $koAnchors = Get-AnchorsFromRow -Row $row -LangKey "ko"
    $jaAnchors = Get-AnchorsFromRow -Row $row -LangKey "ja"

    $item = [ordered]@{
        year      = $yearStr
        en        = $enVal
        enAnchors = $enAnchors
        ko        = $koVal
        koAnchors = $koAnchors
        ja        = $jaVal
        jaAnchors = $jaAnchors
    }

    if (-not $daysMap.ContainsKey($dcode)) {
        $daysMap[$dcode] = @()
    }
    $daysMap[$dcode] += $item
}

$meta = [ordered]@{
    country    = $Country
    quarter    = $Quarter
    updatedAt  = (Get-Date).ToString("o")
    sourceFile = $InputCsv
}

$result = [ordered]@{
    meta = $meta
    days = $daysMap
}

$dir = Split-Path $OutputJson -Parent
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
}

$result | ConvertTo-Json -Depth 10 | Set-Content -Path $OutputJson -Encoding UTF8

Write-Host "✅ Done. Saved JSON to $OutputJson"
