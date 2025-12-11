param(
    [string]$CsvRoot = ".",
    [string]$OutRoot = "..\assets\seed"
)

# ================================
#  공통: 앵커 배열 만드는 함수
# ================================
function New-Anchors {
    param(
        [string]$Text1, [string]$Url1,
        [string]$Text2, [string]$Url2
    )

    $anchors = @()

    if ($Text1 -or $Url1) {
        $anchors += @{
            text = $Text1
            url  = $Url1
        }
    }

    if ($Text2 -or $Url2) {
        $anchors += @{
            text = $Text2
            url  = $Url2
        }
    }

    return $anchors
}

# ================================
#  한 줄(row)을 HistoryItem 으로 변환
# ================================
function Convert-RowToHistoryItem {
    param(
        [pscustomobject]$row
    )

    $item  = [ordered]@{}

    # ===== year =====
    if ($row.Year) {
        $yearInt = 0
        if ([int]::TryParse($row.Year, [ref]$yearInt)) {
            $item.year = $yearInt
        } else {
            $item.year = $row.Year
        }
    }

    # ===== English 본문 =====
    if ($row.English) {
        $item.en = $row.English
    }

    # ===== 컬럼 순서 유지를 위해 props 배열로 받기 =====
    $props = @($row.PSObject.Properties)

    function Get-BodyBeforeAnchor {
        param([string]$anchorName)

        for ($i = 0; $i -lt $props.Count; $i++) {
            if ($props[$i].Name -eq $anchorName) {
                if ($i -gt 0) {
                    return $props[$i - 1].Value
                }
            }
        }
        return $null
    }

    # ===== 각 언어 본문: Anchor_text1_* 바로 왼쪽 컬럼을 본문으로 사용 =====
    $koBody = Get-BodyBeforeAnchor -anchorName 'Anchor_text1_korean'
    if ($koBody) { $item.ko = $koBody }

    $jaBody = Get-BodyBeforeAnchor -anchorName 'Anchor_text1_japanese'
    if ($jaBody) { $item.ja = $jaBody }

    $scBody = Get-BodyBeforeAnchor -anchorName 'Anchor_text1_sc'
    if ($scBody) { $item.sc = $scBody }

    $tcBody = Get-BodyBeforeAnchor -anchorName 'Anchor_text1_tc'
    if ($tcBody) { $item.tc = $tcBody }

    $esBody = Get-BodyBeforeAnchor -anchorName 'Anchor_text1_es'
    if ($esBody) { $item.es = $esBody }

    $frBody = Get-BodyBeforeAnchor -anchorName 'Anchor_text1_fr'
    if ($frBody) { $item.fr = $frBody }

    # ===== 앵커: 컬럼 이름을 직접 써서 가져오기 =====
    function Get-LangAnchors {
        param([string]$suffix)

        $a1Name = "Anchor_text1_$suffix"
        $u1Name = "URL1_$suffix"
        $a2Name = "Anchor_text2_$suffix"
        $u2Name = "URL2_$suffix"

        $text1 = $row.$a1Name
        $url1  = $row.$u1Name
        $text2 = $row.$a2Name
        $url2  = $row.$u2Name

        return (New-Anchors -Text1 $text1 -Url1 $url1 -Text2 $text2 -Url2 $url2)
    }

    # en
    $enAnchors = Get-LangAnchors -suffix 'english'
    if ($enAnchors.Count -gt 0) { $item.enAnchors = $enAnchors }

    # ko
    $koAnchors = Get-LangAnchors -suffix 'korean'
    if ($koAnchors.Count -gt 0) { $item.koAnchors = $koAnchors }

    # ja
    $jaAnchors = Get-LangAnchors -suffix 'japanese'
    if ($jaAnchors.Count -gt 0) { $item.jaAnchors = $jaAnchors }

    # sc
    $scAnchors = Get-LangAnchors -suffix 'sc'
    if ($scAnchors.Count -gt 0) { $item.scAnchors = $scAnchors }

    # tc
    $tcAnchors = Get-LangAnchors -suffix 'tc'
    if ($tcAnchors.Count -gt 0) { $item.tcAnchors = $tcAnchors }

    # es
    $esAnchors = Get-LangAnchors -suffix 'es'
    if ($esAnchors.Count -gt 0) { $item.esAnchors = $esAnchors }

    # fr
    $frAnchors = Get-LangAnchors -suffix 'fr'
    if ($frAnchors.Count -gt 0) { $item.frAnchors = $frAnchors }

    return $item
}


# ================================
#  출력 JSON 이름 결정
# ================================
function Get-OutputNameFromCsv {
    param(
        [string]$CsvName  # e.g. "Today Data - Korea Q1.csv"
    )

    $base = [System.IO.Path]::GetFileNameWithoutExtension($CsvName)

    if ($base -like "Today Data -*") {
        $base = $base.Replace("Today Data - ", "").Trim()
    }

    $parts = $base.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)

    if ($parts.Count -eq 2) {
        $region = $parts[0].ToLower()   # korea, japan, world, china ...
        $suffix = $parts[1]             # Q1, Q2, All, 01, 02 ...
        return "$region-$suffix.json"
    } else {
        return ($base.ToLower().Replace(" ", "") + ".json")
    }
}

# ================================
#  메인 로직
# ================================
Write-Host "CSV root : $CsvRoot"
Write-Host "Out root : $OutRoot"

if (-not (Test-Path $OutRoot)) {
    Write-Host "Output directory not found. Creating: $OutRoot"
    New-Item -ItemType Directory -Path $OutRoot | Out-Null
}

$csvFiles = Get-ChildItem -Path $CsvRoot -Filter "Today Data - *.csv" -File

if ($csvFiles.Count -eq 0) {
    Write-Warning "CSV files not found. (Pattern: 'Today Data - *.csv')"
}

foreach ($file in $csvFiles) {
    Write-Host ""
    Write-Host "==============================="
    Write-Host "Processing CSV: $($file.Name)"
    Write-Host "==============================="

    $rows = Import-Csv -Path $file.FullName -Encoding UTF8

    if ($rows.Count -eq 0) {
        Write-Warning "  -> No rows in CSV, skipping."
        continue
    }

    # Date 컬럼에 값이 하나라도 있는지 확인
    $hasNonEmptyDate = $rows |
        Where-Object { $_.Date -and $_.Date.Trim() -ne "" } |
        Select-Object -First 1

    if ($hasNonEmptyDate) {
        Write-Host "  -> Detected non-empty Date column. Using Date -> DMMDD keys."
    } else {
        Write-Host "  -> Date column empty. Using single bucket key 'D0000'."
    }

    $days = @{}
    $rowIndex = 0

    foreach ($row in $rows) {
        $rowIndex++

        # 날짜 키 결정
        if ($hasNonEmptyDate) {
            if (-not $row.Date -or $row.Date.Trim() -eq "") {
                continue
            }
            $dateKey = "D" + $row.Date.Trim().PadLeft(4, '0')
        } else {
            # 중국 All 처럼 Date가 비어 있는 경우: 전부 D0000
            $dateKey = "D0000"
        }

        if (-not $days.ContainsKey($dateKey)) {
            $days[$dateKey] = @()
        }

        $item = Convert-RowToHistoryItem -row $row
        $days[$dateKey] += $item
    }

    $bucket = [ordered]@{
        days = $days
    }

    $outName = Get-OutputNameFromCsv -CsvName $file.Name
    $outPath = Join-Path $OutRoot $outName

    Write-Host "  -> Writing JSON: $outPath"
    Write-Host "  -> Days count : $($days.Keys.Count)"
    Write-Host "  -> Total rows : $rowIndex"

    try {
        ConvertTo-Json $bucket -Depth 10 |
            Out-File -FilePath $outPath -Encoding utf8NoBOM
    } catch {
        ConvertTo-Json $bucket -Depth 10 |
            Out-File -FilePath $outPath -Encoding UTF8
    }
}

Write-Host ""
Write-Host "Done."
