// JSON 파일 기반 시계열 저장소 (네이티브 의존성 0)
// 구조: { meta:{updatedAt}, series: { "<ticker>": [ {ts, bySource:{}, total} ] } }
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'buzz.json');

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) writeFileSync(DATA_FILE, JSON.stringify({ meta: {}, series: {} }, null, 2));
}

export function load() {
  ensure();
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')); }
  catch { return { meta: {}, series: {} }; }
}

export function save(db) {
  ensure();
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// 한 번의 수집 결과를 추가 (ticker별 1개 레코드)
export function appendPoint(ticker, bySource, ts) {
  const db = load();
  const total = Object.values(bySource).reduce((a, b) => a + (b || 0), 0);
  if (!db.series[ticker]) db.series[ticker] = [];
  db.series[ticker].push({ ts, bySource, total });
  // 보관 한도 초과 시 오래된 것 제거
  if (db.series[ticker].length > CONFIG.maxPoints) {
    db.series[ticker] = db.series[ticker].slice(-CONFIG.maxPoints);
  }
  db.meta.updatedAt = new Date(ts).toISOString();
  save(db);
}

export function getSeries(ticker) {
  return load().series[ticker] || [];
}
