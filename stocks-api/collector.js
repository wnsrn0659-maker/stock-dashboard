// 수집기 — 모든 종목의 소스별 언급량을 모아 저장소에 1구간씩 적재
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TICKERS, CONFIG, sleep } from './config.js';
import { appendPoint } from './store.js';
import { fetchStockTwits } from './sources/stocktwits.js';
import { fetchReddit } from './sources/reddit.js';
import { fetchNaverBoard } from './sources/naver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NAVER_STATE = join(__dirname, 'data', 'naver_state.json');

// 네이버는 '오늘 누적' 값 → 직전 수집값과의 차이(delta)를 구간 언급량으로 사용
function naverDelta(code, cumulative) {
  let state = {};
  if (existsSync(NAVER_STATE)) {
    try { state = JSON.parse(readFileSync(NAVER_STATE, 'utf-8')); } catch {}
  }
  const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const prev = state[code];
  let delta = cumulative;
  if (prev && prev.date === kst) delta = Math.max(0, cumulative - prev.cum);
  state[code] = { date: kst, cum: cumulative };
  writeFileSync(NAVER_STATE, JSON.stringify(state, null, 2));
  return delta;
}

export async function collectOnce() {
  const ts = Date.now();
  const intervalMin = 15;
  console.log(`\n[collect] ${new Date(ts).toISOString()} 수집 시작`);

  // ---- 미국: StockTwits + Reddit ----
  for (const t of TICKERS.US) {
    const st = await fetchStockTwits(t.stocktwits, intervalMin);
    await sleep(CONFIG.fetchDelayMs);
    const rd = await fetchReddit(t.reddit, intervalMin);
    await sleep(CONFIG.fetchDelayMs);
    appendPoint(t.ticker, { stocktwits: st, reddit: rd }, ts);
    console.log(`  ${t.ticker}: stocktwits=${st} reddit=${rd}`);
  }

  // ---- 한국: 네이버 종목토론방 ----
  for (const t of TICKERS.KR) {
    const cum = await fetchNaverBoard(t.naverCode);
    const delta = naverDelta(t.naverCode, cum);
    await sleep(CONFIG.fetchDelayMs);
    appendPoint(t.ticker, { naver: delta }, ts);
    console.log(`  ${t.ticker}(${t.name}): naver Δ=${delta} (누적 ${cum})`);
  }

  console.log('[collect] 완료');
}

// 단독 실행 시 1회 수집
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('collector.js')) {
  collectOnce().then(() => process.exit(0));
}
