// Reddit 검색 — 최근 구간 내 종목 언급 게시글 수
// 애플리케이션 전용 OAuth(client_credentials). 자격증명 없으면 자동 스킵.
import { CONFIG } from '../config.js';

let token = null;
let tokenExp = 0;

async function getToken() {
  const { clientId, clientSecret, userAgent } = CONFIG.reddit;
  if (!clientId || !clientSecret) return null;
  if (token && Date.now() < tokenExp) return token;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: 'grant_type=client_credentials',
    });
    const j = await res.json();
    token = j.access_token;
    tokenExp = Date.now() + (j.expires_in - 60) * 1000;
    return token;
  } catch (e) {
    console.error('[reddit] 토큰 실패:', e.message);
    return null;
  }
}

export async function fetchReddit(keywords, intervalMin = 15) {
  const tk = await getToken();
  if (!tk) return 0; // 자격증명 미설정 → 스킵
  const q = keywords.map((k) => `"${k}"`).join(' OR ');
  try {
    const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(q)}&sort=new&limit=100&t=hour`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tk}`, 'User-Agent': CONFIG.reddit.userAgent },
    });
    if (!res.ok) return 0;
    const j = await res.json();
    const posts = j?.data?.children || [];
    const cutoff = Date.now() - intervalMin * 60 * 1000;
    return posts.filter((p) => (p.data.created_utc * 1000) >= cutoff).length;
  } catch (e) {
    console.error('[reddit] 검색 실패:', e.message);
    return 0;
  }
}
