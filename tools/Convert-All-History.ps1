param(
    [string]$CsvRoot = ".",
    [string]$OutRoot = ".\assets\seed"
)

# 🔍 특정 패턴이 들어간 컬럼 값 가져오기 (앞뒤 공백 정리)
function Get-ColumnValue {
    param(
        [pscustomobject]$row,
        [string]$pattern
    )

    $prop = $row.PSObject.Properties |
        ForEach-Object {
            [pscustomobject]@{
                Name  = $_.Name.Trim()
                Value = $_.Value
            }
        } |
        Where-Object { $_.Name -like "*$pattern*" } |
        Select-Object -First 1

    if ($prop) {
        return $prop.Value
    }

    return $null
}

# 앵커 배열 만드는 함수
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

# CSV 한 줄을 HistoryItem 객체로 변환
function Convert-RowToHistoryItem {
    param(
        [pscustomobject]$row
    )

    $item = [ordered]@{}

    # year
    if ($row.Year) {
        $yearInt = 0
        if ([int]::TryParse($row.Year, [ref]$yearInt)) {
            $item.year = $yearInt
        } else {
            $item.year = $row.Year
        }
    }

    # 영어 본문
    if ($row.English) {
        $item.en = $row.English
    }

    # ⚠️ 본문 컬럼만 추려서 ko / ja 매핑
    $descProps = $row.PSObject.Properties |
        Where-Object {
            $_.Name -ne 'Date' -and
            $_.Name -ne 'Year' -and
            $_.Name -ne 'English' -and
            ($_.Name -notlike 'Anchor_text*') -and
            ($_.Name -notlike 'URL*')
        }

    $descProps = @($descProps)

    if ($descProps.Count -ge 1 -and $descProps[0].Value) {
        $item.ko = $descProps[0].Value
    }
    if ($descProps.Count -ge 2 -and $descProps[1].Value) {
        $item.ja = $descProps[1].Value
    }

    # 영어 앵커
    $enAnchors = New-Anchors `
        $row.Anchor_text1_english $row.URL1_english `
        $row.Anchor_text2_english $row.URL2_english
    if ($enAnchors.Count -gt 0) {
        $item.enAnchors = $enAnchors
    }

    # 한국어 앵커
    $koAnchors = New-Anchors `
        $row.Anchor_text1_korean $row.URL1_korean `
        $row.Anchor_text2_korean $row.URL2_korean
    if ($koAnchors.Count -gt 0) {
        $item.koAnchors = $koAnchors
    }

    # 일본어 앵커
    $jaAnchors = New-Anchors `
        $row.Anchor_text1_japanese $row.URL1_japanese `
        $row.Anchor_text2_japanese $row.URL2_japanese
    if ($jaAnchors.Count -gt 0) {
        $item.jaAnchors = $jaAnchors
    }

    return $item
}

# 파일 이름을 보고 출력 JSON 파일 이름 결정
function Get-OutputNameFromCsv {
    param(
        [string]$CsvName  # e.g. "Today Data - Korea Q1.csv"
    )

    # 확장자 제거
    $base = [System.IO.Path]::GetFileNameWithoutExtension($CsvName)

    # "Today Data - " 제거
    if ($base -like "Today Data -*") {
        $base = $base.Replace("Today Data - ", "").Trim()
    }

    # 예: "Korea Q1", "Japan Q3", "world 01"
    $parts = $base.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)

    if ($parts.Count -eq 2) {
        $region = $parts[0].ToLower()   # korea, japan, world
        $suffix = $parts[1]             # Q1, Q2, 01, 02 ...
        return "$region-$suffix.json"
    } else {
        return ($base.ToLower().Replace(" ", "") + ".json")
    }
}

# 메인 로직 시작
Write-Host "CSV root: $CsvRoot"
Write-Host "Output root: $OutRoot"

if (-not (Test-Path $OutRoot)) {
    Write-Host "Output directory not found. Creating: $OutRoot"
    New-Item -ItemType Directory -Path $OutRoot | Out-Null
}

# 폴더 내 모든 "Today Data - *.csv" 파일 처리
$csvFiles = Get-ChildItem -Path $CsvRoot -Filter "Today Data - *.csv" -File

if ($csvFiles.Count -eq 0) {
    Write-Warning "CSV files not found. (Pattern: 'Today Data - *.csv')"
}

foreach ($file in $csvFiles) {
    Write-Host "Processing CSV: $($file.Name)"

    # CSV 로드 (UTF-8)
    $rows = Import-Csv -Path $file.FullName -Encoding UTF8

    # 🔍 디버그: 첫 줄의 컬럼 이름/샘플 값 확인
    if ($rows.Count -gt 0) {
        Write-Host "  Columns and sample values:"
        $first = $rows[0]
        $first.PSObject.Properties | ForEach-Object {
            $name = $_.Name
            $val  = $_.Value
            $sample = ""
            if ($val -ne $null) {
                $s = $val.ToString()
                if ($s.Length -gt 30) {
                    $sample = $s.Substring(0, 30) + "..."
                } else {
                    $sample = $s
                }
            }
            Write-Host "    [$name] = '$sample'"
        }
    }

    # days 오브젝트 (DMMDD -> 배열)
    $days = @{}

    foreach ($row in $rows) {
        if (-not $row.Date) { continue }

        # "1201" -> "D1201"
        $dateKey = "D" + $row.Date.PadLeft(4, '0')

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

    Write-Host " -> Writing JSON: $outPath"

    try {
        ConvertTo-Json $bucket -Depth 10 |
            Out-File -FilePath $outPath -Encoding utf8NoBOM
    } catch {
        ConvertTo-Json $bucket -Depth 10 |
            Out-File -FilePath $outPath -Encoding UTF8
    }
}

Write-Host "Done."
