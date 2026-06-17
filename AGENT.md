# 🤖 대시보드 자동 갱신 에이전트 지침

대시보드(`stock-dashboard.html`)는 열릴 때마다 **`data.json`을 GitHub에서 불러와** 표시한다.
따라서 에이전트는 **`data.json`만 수정**하면 된다(HTML은 건드리지 않는다). data.json은 순수 JSON이라 안전하다.

라우틴 2개:
- **매일(daily)** 아침 1회: ① 주가 ② 발굴주 ③ 급반등
- **매시간(hourly)** 1시간마다: ④ 주요 뉴스

수정 후 **반드시 `git pull --rebase origin main`으로 최신화**한 뒤 커밋·푸시(두 라우틴이 같은 파일을 건드리므로).

---

## data.json 구조
```json
{
  "STOCKS":   [ {"tkr":"NVDA","price":211.02,"prevPct":2.8}, ... ],   // 주가 (daily)
  "HIDDEN":   { "US":[ {종목}, x6 ], "KR":[ x6 ] },                    // 우량 발굴주 (daily)
  "HIDDEN_CHEAP": { "US":[ x3 ], "KR":[ x3 ] },                       // 저가 발굴주 (daily)
  "REBOUND":  { "US":[ {"tkr":"AMD","score":88,"d":"근거"}, x3~4 ], "KR":[ ... ] },  // 급반등 (daily)
  "NEWS":     { "US":[ {"tag":"NVDA","cls":"up","h":"헤드라인","m":"날짜·출처·부연"}, x6~8 ], "KR":[ ... ] },  // 뉴스 (hourly)
  "SURGE":    { "US":[ {"name":"종목명","tkr":"티커","px":"가격(M/D)","sig":"조짐유형","why":"포착신호","watch":"임박촉매","risk":"리스크"}, x3~5 ], "KR":[ ... ] }  // 급등 조짐 (daily)
}
```

발굴주 종목 객체 형식:
`{"name":"종목명","tkr":"티커/코드","sig":"한줄신호","px":"가격(저가주만, 'M/D 종가')","whyMe":"왜 골랐는지(1인칭)","signal":"공개신호","buzz":1~5,"buzzTxt":"커뮤니티 버즈·심리","risk":"핵심 리스크"}`
- 우량주(HIDDEN)는 `px` 생략. 저가주(HIDDEN_CHEAP)는 `px`에 실제 종가 기입.

NEWS의 cls: `"up"`=호재 / `"down"`=악재 / `"new"`=중립·신규.

---

## 엄수 규칙
- **반드시 유효한 JSON** — 키·문자열 모두 큰따옴표("), 끝쉼표(trailing comma) 금지. 수정 후 `node -e "JSON.parse(require('fs').readFileSync('data.json','utf8'))"` 또는 동등한 방법으로 파싱 검증.
- **가격은 추측 금지** — 웹에서 실제 최신 종가 확인. 확인 불가하면 그대로 둠.
- 한국어로 작성, 한국 tkr는 6자리 코드.
- 변경할 내용 없으면 아무것도 하지 말 것.

## 담당 분담
- **daily 라우틴**: `STOCKS`(미국·한국 주요 종목 가격), `HIDDEN`, `HIDDEN_CHEAP`, `REBOUND`, `SURGE` 갱신.
  - 주가: 미국 USD 소수 2자리 / 한국 KRW 정수. 대상 = STOCKS에 있는 모든 tkr.
  - 발굴주: 너무 유명한 대형주 제외, 매일 2~3개 새 종목 교체.
  - 급반등(REBOUND): 낙폭+기관지지+모멘텀 기준, score 0~100.
  - **급등 조짐(SURGE)**: 웹에서 "터지기 전 선행 신호"가 있는 종목을 미국·한국 각 3~5개 스캔. 기준 = 평소 대비 거래량 급증 / 저유동성(float 작음) / 공매도 과다(숏스퀴즈 가능) / 프리마켓·시간외 급등 / 52주 신고가 돌파 직전 / 임박 촉매(실적·합병·계약·FDA·정책). px는 실제 종가만(추측 금지). 예측이 아니라 '신호 포착'임을 전제로, 검증 가능한 근거(why)와 임박 이벤트(watch)를 적는다. 근거 없는 추측 종목은 넣지 말 것.
    - **스캔 테마 범위**: AI·반도체뿐 아니라 **희소가치 자원/critical minerals**(희토류·리튬·우라늄·구리·니켈·코발트·갈륨·게르마늄·텅스텐·흑연·희귀금속 등) 테마도 포함. 자원 수출통제·가격 급등·수급 차질·정책(자원 안보) 등 촉매로 급등 조짐 보이는 자원 관련주를 미국·한국에서 함께 발굴해 SURGE에 섞어 넣을 것.
- **hourly 라우틴**: `NEWS`만 갱신. 그 시각 최신 뉴스로 각 시장 6~8개, 오래된 건 제거.

## 작업 절차
1. `git pull --rebase origin main`
2. `data.json`의 담당 키만 갱신
3. JSON 파싱 검증
4. 커밋·푸시 (daily: `일일 갱신 YYYY-MM-DD` / hourly: `뉴스 갱신 YYYY-MM-DD HH시`). 푸시 거절 시 `git pull --rebase` 후 재푸시.
