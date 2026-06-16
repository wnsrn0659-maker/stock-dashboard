// API 서버 — GET /api/buzz?market=US|KR  →  종목별 buzz 레벨/추세/급증여부
// --with-collector 플래그로 실행하면 node-cron 수집도 같은 프로세스에서 구동
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { TICKERS, CONFIG } from './config.js';
import { getSeries, load } from './store.js';
import { computeBuzz } from './buzzScore.js';
import { collectOnce } from './collector.js';
import { fetchNaverPrice } from './sources/naverPrice.js';

const app = express();
app.use(cors()); // 정적 대시보드(다른 origin)에서 호출 허용

// 한국 종목 실시간 시세 (네이버) — 대시보드가 30분마다 폴링
app.get('/api/quote', async (req, res) => {
  const market = (req.query.market || 'KR').toUpperCase();
  if (market !== 'KR') return res.status(400).json({ error: 'KR 전용 (미국은 Finnhub 사용)' });
  const quotes = {};
  for (const t of TICKERS.KR) {
    const q = await fetchNaverPrice(t.naverCode);
    if (q) quotes[t.ticker] = q;
    await new Promise((r) => setTimeout(r, 300));
  }
  res.json({ market, updatedAt: new Date().toISOString(), quotes });
});

app.get('/api/buzz', (req, res) => {
  const market = (req.query.market || 'US').toUpperCase();
  const list = TICKERS[market];
  if (!list) return res.status(400).json({ error: 'market must be US or KR' });
  const data = {};
  for (const t of list) data[t.ticker] = computeBuzz(getSeries(t.ticker));
  res.json({ updatedAt: load().meta.updatedAt || null, market, data });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(CONFIG.port, () => {
  console.log(`[server] http://localhost:${CONFIG.port}/api/buzz?market=US`);
});

// 같은 프로세스에서 수집까지 (pm2로 1개만 띄우고 싶을 때)
if (process.argv.includes('--with-collector')) {
  console.log(`[cron] 스케줄 등록: ${CONFIG.intervalCron}`);
  cron.schedule(CONFIG.intervalCron, () => collectOnce().catch(console.error));
  collectOnce().catch(console.error); // 부팅 직후 1회
}
