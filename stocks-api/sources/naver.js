// 네이버 종목토론방 — 최근 구간 내 게시글 수 (저빈도·캐시 전제, ToS 회색지대)
// 게시판 페이지는 EUC-KR 인코딩 → TextDecoder('euc-kr')로 디코딩
// 부하 최소화를 위해 최대 3페이지만 조회, 호출 간 딜레이는 collector에서 처리.
import * as cheerio from 'cheerio';

const BOARD = 'https://finance.naver.com/item/board.naver';

// 현재 KST 'YYYY.MM.DD'
function todayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

async function fetchPage(code, page) {
  const res = await fetch(`${BOARD}?code=${code}&page=${page}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stocks-buzz/0.1)' },
  });
  if (!res.ok) return '';
  const buf = await res.arrayBuffer();
  return new TextDecoder('euc-kr').decode(buf);
}

// 오늘(KST) 작성된 게시글 수를 카운트 (최근 구간 근사 — 일중 누적)
export async function fetchNaverBoard(code, maxPages = 3) {
  const today = todayKST();
  let count = 0;
  try {
    for (let p = 1; p <= maxPages; p++) {
      const html = await fetchPage(code, p);
      if (!html) break;
      const $ = cheerio.load(html);
      let pageHits = 0;
      // 게시판 표의 날짜 셀: 'YYYY.MM.DD HH:mm'
      $('table.type2 td.date, table.type2 span.tah').each((_, el) => {
        const txt = $(el).text().trim();
        if (txt.startsWith(today)) { count++; pageHits++; }
      });
      // 이 페이지에 오늘 글이 하나도 없으면 더 과거 → 중단
      if (pageHits === 0 && p > 1) break;
    }
    return count;
  } catch (e) {
    console.error(`[naver] ${code} 실패:`, e.message);
    return 0;
  }
}
