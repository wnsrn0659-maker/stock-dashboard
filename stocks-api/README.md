# 종목 버즈 수집 API (MVP)

종목토론방·StockTwits·Reddit 언급량을 15분마다 수집해 "브랜드 언급 급증"을 감지하고
`/api/buzz`로 제공한다. 대시보드(`stock-dashboard.html`)가 이 API를 호출해 실버즈를 표시.

## 구성
```
config.js          수집 대상 종목·설정
collector.js       15분마다 소스에서 언급량 수집 → 저장
server.js          /api/buzz API (+ --with-collector 로 수집 동시 구동)
buzzScore.js       z-score 급증 감지 → 레벨 1~5
store.js           JSON 파일 시계열 저장 (data/buzz.json)
sources/
  stocktwits.js    미국 (무료, 인증X)
  reddit.js        미국 (무료, OAuth — 미설정 시 자동 스킵)
  naver.js         한국 종목토론방 (저빈도 스크랩, EUC-KR 디코딩)
```

## 로컬 실행
```bash
cd stocks-api
npm install

# (선택) Reddit 쓰려면
copy .env.example .env   # 값 채우기. 윈도우는 copy, 맥/리눅스는 cp

# 1) 수집 1회 테스트
node collector.js

# 2) API 서버 + 15분 자동수집 동시 구동
node server.js --with-collector
# → http://localhost:3001/api/buzz?market=US 확인
```

> `.env`를 쓰려면 Node 20+는 `node --env-file=.env server.js`로 실행하거나,
> 환경변수를 직접 export 해도 됨. Reddit 자격증명이 없으면 StockTwits/네이버만 동작.

## 서버 배포 (recurvemarketing.co.kr)
1. `/www/stocks-api/`에 업로드 후 `npm install`
2. pm2로 상주: `pm2 start server.js --name stocks-api -- --with-collector`
3. Nginx 리버스 프록시:
```nginx
location /api/ {
    proxy_pass http://localhost:3001;
}
```
4. 대시보드는 `/www/stocks/index.html`에 배치 → `fetch('/api/buzz?market=US')` 동일 도메인 호출

## 대시보드 연동 (stock-dashboard.html)
`getBuzz()`를 실데이터 fetch로 교체 — 자세한 코드는 `../buzz-backend-design.md` 6번 참고.
실데이터 실패 시 기존 정성값으로 자동 폴백하도록 작성.

## 주의
- **네이버 스크랩은 ToS 회색지대** — 15분 주기·캐시로 부하 최소화, 내부 지표로만 사용 권장.
- StockTwits 스트림은 최신 30건만 제공 → 초급증 종목은 실제보다 과소집계될 수 있음(상한 포착).
- 네이버 지표는 '오늘 누적 게시글'의 구간 증분(Δ)을 사용 (collector에서 자동 계산).
- 수집 데이터가 쌓일수록(최소 1~2일) z-score 급증 감지가 정확해짐.
