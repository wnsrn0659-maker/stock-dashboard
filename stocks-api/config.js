// 수집 대상 종목 설정 — 대시보드(stock-dashboard.html)의 티커와 1:1 매칭
// stocktwits: StockTwits 심볼 / reddit: 검색 키워드 배열 / naverCode: 네이버 종목코드

export const TICKERS = {
  US: [
    { ticker: 'SPCX', stocktwits: 'SPCX', reddit: ['SPCX', 'SpaceX'] },
    { ticker: 'NVDA', stocktwits: 'NVDA', reddit: ['NVDA', 'Nvidia'] },
    { ticker: 'TSLA', stocktwits: 'TSLA', reddit: ['TSLA', 'Tesla'] },
    { ticker: 'AMD',  stocktwits: 'AMD',  reddit: ['AMD'] },
    { ticker: 'AVGO', stocktwits: 'AVGO', reddit: ['AVGO', 'Broadcom'] },
    { ticker: 'MU',   stocktwits: 'MU',   reddit: ['$MU', 'Micron'] },
    { ticker: 'INTC', stocktwits: 'INTC', reddit: ['INTC', 'Intel'] },
  ],
  KR: [
    { ticker: '005930', name: '삼성전자',         naverCode: '005930' },
    { ticker: '000660', name: 'SK하이닉스',        naverCode: '000660' },
    { ticker: '042700', name: '한미반도체',        naverCode: '042700' },
    { ticker: '012450', name: '한화에어로스페이스', naverCode: '012450' },
  ],
};

export const CONFIG = {
  intervalCron: '*/15 * * * *', // 15분마다 수집
  maxPoints: 300,               // 종목별 보관 구간 수 (15분 × 300 ≈ 3일)
  port: process.env.PORT || 3001,
  // 소스 호출 간 지연(ms) — 레이트리밋·부하 보호
  fetchDelayMs: 1200,
  // Reddit OAuth (없으면 Reddit 소스 자동 스킵)
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID || '',
    clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
    userAgent: 'stocks-buzz-collector/0.1 by recurvemkt',
  },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
