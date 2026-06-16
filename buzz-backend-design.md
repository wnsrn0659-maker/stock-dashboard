# 📊 버즈(언급량) 수집 백엔드 설계서

> 목표: 종목토론방·X·Reddit·StockTwits의 **언급량을 주기적으로 수집**해
> "브랜드 언급 급증(buzz spike)"을 자동 감지하고, 대시보드에 **실제 버즈 데이터**를 표시한다.
> 정적 HTML은 CORS·인증 때문에 외부 API를 직접 못 부르므로 **작은 수집기 + API 서버**를 둔다.

---

## 1. 전체 아키텍처

```
 ┌────────────┐   주기 수집(cron 5~15분)   ┌────────────┐
 │  수집기      │ ───────────────────────▶ │  저장소      │
 │ collector  │   각 소스 API/스크랩       │ SQLite     │
 └────────────┘                            │ (시계열)    │
        │                                   └─────┬──────┘
        │ 급증 감지(z-score)                       │ 읽기
        ▼                                          ▼
 ┌────────────┐                            ┌────────────┐    fetch('/api/buzz')
 │ buzz 점수    │                            │  API 서버   │ ◀──────────────────  대시보드(정적)
 │ 계산·캐시    │ ─────────────────────────▶ │ Express    │ ───────────────────▶ stock-dashboard.html
 └────────────┘                            └────────────┘    JSON 응답(CORS 허용)
```

- **수집기(collector.js)**: cron으로 N분마다 각 소스에서 종목별 언급 수를 긁어 저장
- **저장소(buzz.db)**: SQLite 시계열 `(ticker, source, ts, count)`
- **API 서버(server.js)**: `/api/buzz` 한 방으로 종목별 현재 buzz 레벨·추세·급증여부 반환 → CORS 해결
- **대시보드**: 기존 `getBuzz()` 정성값을 `fetch('/api/buzz')` 실데이터로 교체

배포 위치(기존 서버 구조 활용):
```
/www/stocks/                # 대시보드 정적 페이지
  index.html                # = stock-dashboard.html
/www/stocks-api/            # 백엔드(노출 안 함, 내부 포트 3001)
  collector.js
  server.js
  buzz.db
  sources/
    stocktwits.js  naver.js  reddit.js  x.js
  package.json
```
Nginx 리버스 프록시: `recurvemarketing.co.kr/api/buzz` → `localhost:3001`

---

## 2. 데이터 소스별 접근 방법 · 비용 · 한계

| 소스 | 대상 | 접근 방법 | 비용 | 한계/주의 |
|---|---|---|---|---|
| **StockTwits** ⭐추천 | 미국주식 | 공개 API `streams/symbol/{TICKER}.json` | **무료** | 금융 특화라 버즈에 최적. 분당 호출 제한 있음 |
| **Reddit** | 미국주식 | 공식 API(OAuth) `r/stocks`,`r/wallstreetbets` 검색 | **무료**(앱 등록) | 분당 60~100 호출, 종목명 검색 카운트 |
| **X(트위터)** | 글로벌 | 공식 API v2 | **유료**($100/월~, 검색량 적음) | 비싸고 제한 큼 → **2순위 권장** |
| **네이버 종목토론방** | 한국주식 | 모바일 페이지 게시글 수 스크랩 | 무료 | **공식 API 없음**, ToS 회색지대 → 저빈도·캐시·robots 준수 |
| **DC/디시·기타** | 한국주식 | 게시판 스크랩 | 무료 | 변동 잦아 유지보수 필요 |

> 💡 **현실적 권장 조합**
> - 미국: **StockTwits(메인) + Reddit(보조)** — 둘 다 무료, 금융 버즈 품질 좋음
> - 한국: **네이버 종목토론방 일별 게시글 수**(저빈도 스크랩) — 가장 신뢰도 높은 한국 버즈 지표
> - X는 비용 대비 효율이 낮아 **나중에 옵션**으로 추가

---

## 3. 급증(spike) 감지 알고리즘

종목별로 최근 언급 수의 **이동평균·표준편차 대비 현재값**이 얼마나 튀는지 측정.

```
최근 30개 구간(예: 30분봉 또는 30일)의 언급수 → mean, std 계산
zScore = (현재 언급수 - mean) / std
ratio  = 현재 언급수 / 직전 7구간 평균        // 직관적 배수
```

**buzz 레벨(1~5) 매핑** (대시보드 미터와 호환):
| zScore | 레벨 | 의미 |
|---|---|---|
| z < 0.5 | 1 매우낮음 | 평소보다 조용 |
| 0.5~1.0 | 2 낮음 | 평균 수준 |
| 1.0~2.0 | 3 보통 | 관심 상승 |
| 2.0~3.0 | 4 높음 | **언급 급증 시작** |
| z ≥ 3.0 | 5 매우높음 | **🔥 브랜드 폭발 — 과열 경계** |

추가 신호: `ratio ≥ 3` (직전 평균의 3배↑)면 "급증 알림" 플래그 별도 표시.

---

## 4. 저장소 스키마 (SQLite)

```sql
CREATE TABLE mentions (
  ticker TEXT,        -- 'NVDA' / '005930'
  source TEXT,        -- 'stocktwits' | 'reddit' | 'naver' | 'x'
  ts     INTEGER,     -- 수집 시각(unix)
  count  INTEGER,     -- 해당 구간 언급 수
  PRIMARY KEY (ticker, source, ts)
);
CREATE INDEX idx_ticker_ts ON mentions(ticker, ts);
```

---

## 5. API 응답 형식 (`GET /api/buzz?market=US`)

```json
{
  "updatedAt": "2026-06-16T11:30:00+09:00",
  "data": {
    "NVDA": {
      "level": 5, "zScore": 3.4, "ratio": 4.1, "spike": true,
      "byShare": { "stocktwits": 1820, "reddit": 430 },
      "trend": [120,140,180,260,540,1820],
      "txt": "최근 1시간 언급 4.1배 급증 (StockTwits 중심) — 과열 경계"
    },
    "AMD": { "level": 4, "zScore": 2.3, "ratio": 2.8, "spike": true, "...": "..." }
  }
}
```

`txt`는 ratio·소스 비중으로 자동 생성 (예: `"○○배 급증, △△ 중심"`).

---

## 6. 대시보드 연동 (기존 코드 교체)

`stock-dashboard.html`의 `getBuzz()`를 실데이터 fetch로 교체:

```js
let BUZZ_LIVE = {};
async function loadBuzz(market){
  try{
    const r = await fetch(`https://recurvemarketing.co.kr/api/buzz?market=${market}`);
    const j = await r.json();
    BUZZ_LIVE = {...BUZZ_LIVE, ...j.data};
    STOCKS.forEach((s,i)=>{ if(s.market===market) refreshBuzzBlock(s,i); });
  }catch(e){ /* 실패 시 기존 정성 BUZZ 폴백 */ }
}
function getBuzz(tkr){ return BUZZ_LIVE[tkr] || BUZZ[tkr] || {lvl:1,txt:'데이터 없음'}; }
```

→ 실데이터 있으면 실시간 버즈, 없으면 기존 정성값으로 **자동 폴백**.

---

## 7. 기술 스택 (기존 repo와 동일하게 Node.js)

- 런타임: **Node.js**(이미 프로젝트가 Node/Vite)
- 수집: `node-fetch`, `cheerio`(네이버 스크랩 파싱)
- DB: `better-sqlite3` (파일 1개, 설치·운영 간단)
- API: `express` + `cors`
- 스케줄: `node-cron`(앱 내) 또는 리눅스 `crontab`
- 프로세스 관리: `pm2` (자동 재시작·로그)

---

## 8. 단계별 구축 (MVP → 확장)

**1단계 — MVP (반나절)**
- StockTwits만 수집 → SQLite 저장 → `/api/buzz` 1개 엔드포인트 → 대시보드 미국 탭 연동
- 급증 감지(z-score) 기본 적용

**2단계 — 한국 추가 (1일)**
- 네이버 종목토론방 일별 게시글 수 저빈도 스크랩 → 한국 탭 연동

**3단계 — 보조 소스 (선택)**
- Reddit OAuth 추가로 미국 버즈 정확도↑
- 급증 시 알림(텔레그램/이메일) 훅

**4단계 — 고도화 (선택)**
- X API(유료) 추가, 감성분석(긍/부정), 키워드 클라우드, 버즈-주가 상관 차트

---

## 9. 비용 · 법적 주의

- **비용**: StockTwits·Reddit·네이버 = 무료. 서버는 기존 것 재사용 → 추가 비용 0. (X만 유료)
- **법적**: 네이버 등 스크랩은 ToS 회색지대. **저빈도(시간당 1~2회)·캐싱·robots 준수**로 부하 최소화. 상업적 재배포는 피하고 내부 지표로만 사용 권장.
- **레이트리밋**: 각 소스 호출 간 딜레이·재시도·캐시 필수.

---

## 10. 다음 액션 (결정 필요)

1. **소스 범위**: StockTwits+Reddit(무료)로 시작? X(유료)도 처음부터?
2. **수집 주기**: 실시간성 vs 부하 — 5분 / 15분 / 1시간?
3. **스크래핑 수위**: 네이버 종목토론방 포함할지(법적 회색지대 인지하에)
4. 위 확정되면 **1단계 MVP 코드부터 스캐폴딩** 시작
