Set-Location (Split-Path $PSScriptRoot)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Q($clue, $difficulty, $lat, $lng, $country, $answer) {
  [pscustomobject]@{
    clue       = $clue
    category   = "questions"
    type       = "trivia"
    difficulty = $difficulty
    target     = [pscustomobject]@{ lat = $lat; lng = $lng }
    country    = $country
    answer     = $answer
  }
}

$newQuestions = @{
  "north-america" = @(
    Q "Where is Chicago in United States?"                       "easy"   41.8781  -87.6298 "United States" "Chicago"
    Q "Find Miami in United States."                             "easy"   25.7617  -80.1918 "United States" "Miami"
    Q "Where is Houston in United States?"                       "easy"   29.7604  -95.3698 "United States" "Houston"
    Q "Find Phoenix in United States."                           "medium" 33.4484 -112.0740 "United States" "Phoenix"
    Q "Pinpoint Nashville in United States."                     "medium" 36.1627  -86.7816 "United States" "Nashville"
    Q "Pinpoint Portland in United States."                      "medium" 45.5051 -122.6750 "United States" "Portland"
    Q "Where is Yellowstone National Park in United States?"     "medium" 44.4280 -110.5885 "United States" "Yellowstone National Park"
    Q "Pinpoint Havana in Cuba."                                 "hard"   23.1136  -82.3666 "Caribbean"     "Havana"
    Q "Find Guatemala City in Guatemala."                        "medium" 14.6349  -90.5069 "Caribbean"     "Guatemala City"
    Q "Where is Montreal in Canada?"                             "easy"   45.5017  -73.5673 "Canada"        "Montreal"
    Q "Find Calgary in Canada."                                  "medium" 51.0447 -114.0719 "Canada"        "Calgary"
    Q "Pinpoint Quebec City in Canada."                          "hard"   46.8139  -71.2080 "Canada"        "Quebec City"
    Q "Where is Guadalajara in Mexico?"                          "medium" 20.6597 -103.3496 "Mexico"        "Guadalajara"
    Q "Find Grand Canyon in United States."                      "easy"   36.0544 -112.1401 "United States" "Grand Canyon"
    Q "Where is Everglades National Park in United States?"      "medium" 25.2866  -80.8987 "United States" "Everglades National Park"
  )
  "south-america" = @(
    Q "Where is Buenos Aires in Argentina?"                      "easy"  -34.6037  -58.3816 "Argentina"  "Buenos Aires"
    Q "Find Medellin in Colombia."                               "medium"  6.2442  -75.5812 "Colombia"   "Medellin"
    Q "Where is Sao Paulo in Brazil?"                            "easy"  -23.5505  -46.6333 "Brazil"     "Sao Paulo"
    Q "Find Manaus in Brazil."                                   "medium"  -3.1190  -60.0217 "Brazil"     "Manaus"
    Q "Pinpoint Ushuaia in Argentina."                           "hard"  -54.8019  -68.3030 "Argentina"  "Ushuaia"
    Q "Find Asuncion in Paraguay."                               "medium" -25.2867  -57.6470 "Paraguay"   "Asuncion"
    Q "Pinpoint Georgetown in Guyana."                           "hard"    6.8013  -58.1551 "Guyana"     "Georgetown"
    Q "Find Mendoza in Argentina."                               "medium" -32.8908  -68.8272 "Argentina"  "Mendoza"
    Q "Where is Angel Falls in Venezuela?"                       "medium"   5.9678  -62.5352 "Venezuela"  "Angel Falls"
    Q "Pinpoint Recife in Brazil."                               "hard"   -8.0476  -34.8770 "Brazil"     "Recife"
    Q "Find Falkland Islands."                                   "hard"  -51.7963  -59.5236 "Argentina"  "Falkland Islands"
    Q "Where is Lake Maracaibo in Venezuela?"                    "medium"   9.7919  -71.5630 "Venezuela"  "Lake Maracaibo"
    Q "Find Potosi in Bolivia."                                  "hard"  -19.5836  -65.7531 "Bolivia"    "Potosi"
    Q "Pinpoint Cape Horn in Chile."                             "hard"  -55.9840  -67.2740 "Chile"      "Cape Horn"
    Q "Find Montevideo in Uruguay."                              "medium" -34.8941  -56.1522 "Uruguay"    "Montevideo"
  )
  "europe" = @(
    Q "Where is Zurich in Switzerland?"                          "easy"   47.3769    8.5417 "Switzerland" "Zurich"
    Q "Find Naples in Italy."                                    "medium" 40.8518   14.2681 "Italy"       "Naples"
    Q "Where is Manchester in United Kingdom?"                   "easy"   53.4808   -2.2426 "United Kingdom" "Manchester"
    Q "Find Porto in Portugal."                                  "medium" 41.1579   -8.6291 "Portugal"    "Porto"
    Q "Where is Lyon in France?"                                 "medium" 45.7640    4.8357 "France"      "Lyon"
    Q "Find Seville in Spain."                                   "medium" 37.3891   -5.9845 "Spain"       "Seville"
    Q "Pinpoint Valletta in Malta."                              "hard"   35.8997   14.5147 "Italy"       "Valletta"
    Q "Where is Glasgow in United Kingdom?"                      "medium" 55.8642   -4.2518 "United Kingdom" "Glasgow"
    Q "Find Thessaloniki in Greece."                             "medium" 40.6401   22.9444 "Greece"      "Thessaloniki"
    Q "Pinpoint Vilnius in Lithuania."                           "hard"   54.6872   25.2797 "Europe"      "Vilnius"
    Q "Find Salzburg in Austria."                                "medium" 47.8095   13.0550 "Austria"     "Salzburg"
    Q "Where is Lake Como in Italy?"                             "medium" 45.9800    9.2600 "Italy"       "Lake Como"
    Q "Pinpoint Minsk in Belarus."                               "hard"   53.9045   27.5615 "Europe"      "Minsk"
    Q "Find Nicosia in Cyprus."                                  "hard"   35.1856   33.3823 "Europe"      "Nicosia"
    Q "Where is Rhine River in Germany?"                         "easy"   51.2000    6.7000 "Germany"     "Rhine River"
  )
  "middle-east" = @(
    Q "Find Jerusalem in Israel."                                "medium" 31.7683   35.2137 "Israel"               "Jerusalem"
    Q "Where is Beirut in Lebanon?"                              "medium" 33.8938   35.5018 "Israel"               "Beirut"
    Q "Find Tehran in Iran."                                     "medium" 35.6892   51.3890 "Middle East"          "Tehran"
    Q "Pinpoint Muscat in Oman."                                 "hard"   23.5880   58.3829 "United Arab Emirates" "Muscat"
    Q "Find Kuwait City in Kuwait."                              "medium" 29.3759   47.9774 "United Arab Emirates" "Kuwait City"
    Q "Pinpoint Doha in Qatar."                                  "medium" 25.2854   51.5310 "United Arab Emirates" "Doha"
    Q "Find Manama in Bahrain."                                  "hard"   26.2285   50.5860 "United Arab Emirates" "Manama"
    Q "Where is Dead Sea in Jordan?"                             "easy"   31.5000   35.5000 "Jordan"               "Dead Sea"
    Q "Find Riyadh in Saudi Arabia."                             "medium" 24.7136   46.6753 "United Arab Emirates" "Riyadh"
    Q "Pinpoint Nicosia in Cyprus."                              "hard"   35.1856   33.3823 "Israel"               "Cyprus (Nicosia)"
    Q "Where is Euphrates River in Iraq?"                        "medium" 34.0000   43.0000 "Iraq"                 "Euphrates River"
  )
  "asia" = @(
    Q "Where is Shanghai in China?"                              "easy"   31.2304  121.4737 "China"       "Shanghai"
    Q "Find Osaka in Japan."                                     "easy"   34.6937  135.5023 "Japan"       "Osaka"
    Q "Where is Mumbai in India?"                                "easy"   19.0760   72.8777 "India"       "Mumbai"
    Q "Find Seoul in South Korea."                               "easy"   37.5665  126.9780 "China"       "Seoul"
    Q "Where is Taipei in Taiwan?"                               "medium" 25.0330  121.5654 "China"       "Taipei"
    Q "Find Dhaka in Bangladesh."                                "medium" 23.8103   90.4125 "India"       "Dhaka"
    Q "Pinpoint Kabul in Afghanistan."                           "hard"   34.5553   69.2075 "Pakistan"    "Kabul"
    Q "Find Karachi in Pakistan."                                "medium" 24.8607   67.0011 "Pakistan"    "Karachi"
    Q "Where is Phuket in Thailand?"                             "medium"  7.8804   98.3923 "Thailand"    "Phuket"
    Q "Find Ho Chi Minh City in Vietnam."                        "medium" 10.8231  106.6297 "Vietnam"     "Ho Chi Minh City"
    Q "Pinpoint Ulaanbaatar in Mongolia."                        "hard"   47.8864  106.9057 "Mongolia"    "Ulaanbaatar"
    Q "Where is Bali in Indonesia?"                              "medium" -8.3405  115.0920 "Indonesia"   "Bali"
    Q "Find Lhasa in China."                                     "hard"   29.6520   91.1175 "China"       "Lhasa"
    Q "Where is Yellow River in China?"                          "medium" 35.0000  107.0000 "China"       "Yellow River"
    Q "Pinpoint Pyongyang in North Korea."                       "hard"   39.0392  125.7625 "China"       "Pyongyang"
  )
  "oceania" = @(
    Q "Where is Sydney in Australia?"                            "easy"  -33.8688  151.2093 "Australia"       "Sydney"
    Q "Find Melbourne in Australia."                             "easy"  -37.8136  144.9631 "Australia"       "Melbourne"
    Q "Where is Great Barrier Reef in Australia?"                "easy"  -18.2871  147.6992 "Australia"       "Great Barrier Reef"
    Q "Find Queenstown in New Zealand."                          "medium" -45.0312  168.6626 "New Zealand"     "Queenstown"
    Q "Where is Fiji?"                                           "medium" -17.7134  178.0650 "Pacific Ocean"   "Fiji"
    Q "Pinpoint Christchurch in New Zealand."                    "hard"  -43.5321  172.6362 "New Zealand"     "Christchurch"
    Q "Find Uluru in Australia."                                 "medium" -25.3444  131.0369 "Australia"       "Uluru"
    Q "Where is Vanuatu?"                                        "hard"  -15.3767  166.9592 "Pacific Ocean"   "Vanuatu"
    Q "Find Noumea in New Caledonia."                            "hard"  -22.2758  166.4580 "Pacific Ocean"   "Noumea"
    Q "Pinpoint Tonga."                                          "hard"  -21.1790 -175.1982 "Pacific Ocean"   "Tonga"
    Q "Where is Samoa?"                                          "medium" -13.7590 -172.1046 "Pacific Ocean"  "Samoa"
    Q "Find Hobart in Australia."                                "hard"  -42.8821  147.3272 "Australia"       "Hobart"
  )
  "africa" = @(
    Q "Where is Cape Town in South Africa?"                      "easy"  -33.9249   18.4241 "South Africa" "Cape Town"
    Q "Find Marrakech in Morocco."                               "easy"   31.6295   -7.9811 "Morocco"      "Marrakech"
    Q "Where is Zanzibar in Tanzania?"                           "medium"  -6.1630   39.2026 "Tanzania"     "Zanzibar"
    Q "Find Casablanca in Morocco."                              "easy"   33.5731   -7.5898 "Morocco"      "Casablanca"
    Q "Where is Luxor in Egypt?"                                 "medium" 25.6872   32.6396 "Egypt"        "Luxor"
    Q "Find Accra in Ghana."                                     "medium"  5.6037   -0.1870 "Various"      "Accra"
    Q "Where is Lagos in Nigeria?"                               "medium"  6.5244    3.3792 "Various"      "Lagos"
    Q "Pinpoint Abuja in Nigeria."                               "hard"    9.0765    7.3986 "Various"      "Abuja"
    Q "Find Dakar in Senegal."                                   "medium" 14.7167  -17.4677 "Various"      "Dakar"
    Q "Where is Kilimanjaro National Park in Tanzania?"          "medium" -3.0674    37.3556 "Tanzania"     "Kilimanjaro National Park"
    Q "Pinpoint Timbuktu in Mali."                               "hard"   16.7735   -3.0074 "Mali"         "Timbuktu"
    Q "Find Serengeti National Park in Tanzania."                "medium" -2.3332   34.8333 "Tanzania"     "Serengeti National Park"
    Q "Where is Aswan in Egypt?"                                 "medium" 24.0889   32.8998 "Egypt"        "Aswan"
    Q "Find Nairobi National Park in Kenya."                     "medium" -1.3617   36.8488 "Kenya"        "Nairobi National Park"
    Q "Pinpoint Mogadishu in Somalia."                           "hard"    2.0469   45.3418 "Various"      "Mogadishu"
  )
}

foreach ($continent in $newQuestions.Keys) {
  $path = "data/locations-$continent.json"
  $doc = Get-Content $path -Raw | ConvertFrom-Json

  $existingAnswerSet = [System.Collections.Generic.HashSet[string]]@(
    $doc.locations |
      Where-Object { $_.PSObject.Properties.Name -contains 'answer' } |
      ForEach-Object { $_.answer.Trim().ToLowerInvariant() }
  )
  $existingClueSet = [System.Collections.Generic.HashSet[string]]@(
    $doc.locations | ForEach-Object { $_.clue.Trim().ToLowerInvariant() }
  )

  $out = [System.Collections.ArrayList]@($doc.locations)
  $added = 0
  foreach ($q in $newQuestions[$continent]) {
    $aKey = $q.answer.Trim().ToLowerInvariant()
    $cKey = $q.clue.Trim().ToLowerInvariant()
    if (-not $existingAnswerSet.Contains($aKey) -and -not $existingClueSet.Contains($cKey)) {
      [void]$out.Add($q)
      $added++
      "  + $($q.answer) ($($q.country))"
    } else {
      "  SKIP: $($q.answer)"
    }
  }

  $doc.locations = $out
  $json = $doc | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText((Join-Path $PWD $path), $json, $utf8NoBom)
  "=== $continent`: +$added added, total $($doc.locations.Count) ==="
}
