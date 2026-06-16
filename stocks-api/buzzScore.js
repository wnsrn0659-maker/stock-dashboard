// 급증(spike) 감지 — z-score 기반 buzz 레벨(1~5) 산출
// 입력: 수집 시계열 [{ts, bySource, total}], 최신이 마지막

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}

export function computeBuzz(series) {
  if (!series.length) return { level: 1, zScore: 0, ratio: 1, spike: false, bySource: {}, trend: [], txt: '데이터 수집 전' };

  const counts = series.map((p) => p.total);
  const latest = counts[counts.length - 1];
  const hist = counts.slice(-31, -1);           // 직전 최대 30구간 (현재 제외)

  // 콜드 스타트: 기준선(직전 구간)이 부족하면 급증 판단 불가 → '수집 중' 안내
  if (hist.length < 5) {
    const bySrc = series[series.length - 1].bySource || {};
    return {
      level: 2, zScore: 0, ratio: 1, spike: false, warming: true,
      bySource: bySrc, trend: counts.slice(-12),
      txt: `📊 수집 시작 — 기준선 형성 중 (현재 ${latest}건, ${series.length}구간 누적). 1~2일 모이면 급증 감지가 정확해집니다.`,
    };
  }

  const m = mean(hist), s = std(hist);
  const z = s > 0 ? (latest - m) / s : 0;
  const last7 = hist.slice(-7);
  const base = mean(last7) || 1;
  const ratio = latest / base;

  // 레벨 매핑
  let level = 1;
  if (z >= 3.0) level = 5;
  else if (z >= 2.0) level = 4;
  else if (z >= 1.0) level = 3;
  else if (z >= 0.5) level = 2;
  else level = 1;
  const spike = ratio >= 3 || z >= 3;

  // 소스 비중 (최신 구간)
  const bySource = series[series.length - 1].bySource || {};
  const topSrc = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
  const srcName = { stocktwits: 'StockTwits', reddit: 'Reddit', naver: '네이버 종토방' }[topSrc?.[0]] || '복합';

  // 자동 코멘트
  let txt;
  if (level >= 5) txt = `🔥 언급 ${ratio.toFixed(1)}배 폭증 (${srcName} 중심) — 과열 경계`;
  else if (level === 4) txt = `언급 ${ratio.toFixed(1)}배 급증 (${srcName} 중심) — 관심 빠르게 상승`;
  else if (level === 3) txt = `평소 대비 ${ratio.toFixed(1)}배, 관심 상승 중 (${srcName})`;
  else if (level === 2) txt = `평균 수준의 언급량 (${srcName})`;
  else txt = '조용함 — 평소보다 낮은 언급량';

  return {
    level,
    zScore: +z.toFixed(2),
    ratio: +ratio.toFixed(2),
    spike,
    bySource,
    trend: counts.slice(-12),  // 최근 12구간 추이
    txt,
  };
}
