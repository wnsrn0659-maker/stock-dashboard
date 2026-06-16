// 네이버 실시간 시세 — 한국 종목 현재가/등락률 조회
// m.stock.naver.com 기본 시세 API(JSON) 사용
// 반환: { price:Number, changePct:Number } | null

export async function fetchNaverPrice(code) {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://m.stock.naver.com/' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const price = Number(String(j.closePrice || '').replace(/,/g, ''));
    let pct = Number(j.fluctuationsRatio);
    // 등락 방향 코드: 1상한·2상승 = +, 4하한·5하락 = -, 3보합 = 0
    const code2 = j.compareToPreviousPrice?.code;
    if (['4', '5'].includes(String(code2)) && pct > 0) pct = -pct;
    if (!price || Number.isNaN(price)) return null;
    return { price, changePct: Number.isNaN(pct) ? 0 : pct };
  } catch (e) {
    console.error(`[naverPrice] ${code} 실패:`, e.message);
    return null;
  }
}
