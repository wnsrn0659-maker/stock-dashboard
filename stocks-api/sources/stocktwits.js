// StockTwits 공개 API — 종목 스트림 최신 메시지 수집
// 무료, 인증 불필요. 분당 호출 제한 있으므로 종목 간 딜레이 권장.
// 반환: 최근 intervalMin분 이내 메시지 수

const API = 'https://api.stocktwits.com/api/2/streams/symbol';

export async function fetchStockTwits(symbol, intervalMin = 15) {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(symbol)}.json`, {
      headers: { 'User-Agent': 'stocks-buzz-collector/0.1' },
    });
    if (!res.ok) return 0;
    const json = await res.json();
    const msgs = json?.messages || [];
    const cutoff = Date.now() - intervalMin * 60 * 1000;
    // created_at: ISO 문자열. 최근 구간 메시지만 카운트
    const recent = msgs.filter((m) => new Date(m.created_at).getTime() >= cutoff);
    // 스트림은 최신 30건만 주므로, 30건이 전부 최근이면 '최소 30+' (상한 포착)
    return recent.length;
  } catch (e) {
    console.error(`[stocktwits] ${symbol} 실패:`, e.message);
    return 0;
  }
}
