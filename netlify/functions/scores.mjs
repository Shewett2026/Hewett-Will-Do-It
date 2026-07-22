import { getStore } from '@netlify/blobs';

// Kern River Run — high-score board. Same Netlify Blobs pattern as votes.mjs.
const MAX_STORED  = 200;   // keep at most this many entries in the blob
const TOP_RETURN  = 25;    // number returned to the client
const MAX_NAME    = 10;

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'no-store'
};

function store() {
  return getStore('kern-river-scores');
}

// Sanitize + sort desc by score, cap length.
function clean(list) {
  return (Array.isArray(list) ? list : [])
    .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
    .map(e => ({
      name:    String(e.name).slice(0, MAX_NAME),
      score:   Math.max(0, Math.floor(e.score)),
      oranges: Math.max(0, Math.floor(e.oranges || 0)),
      ts:      Number(e.ts) || 0
    }))
    .sort((a, b) => b.score - a.score || b.oranges - a.oranges)
    .slice(0, MAX_STORED);
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }

  if (req.method === 'GET') {
    try {
      const raw  = await store().get('scores', { consistency: 'strong' });
      const list = clean(raw ? JSON.parse(raw) : []);
      return new Response(JSON.stringify(list.slice(0, TOP_RETURN)), { status: 200, headers: HEADERS });
    } catch (e) {
      console.error('[scores-fn] GET error:', e.message || String(e));
      return new Response(JSON.stringify([]), { status: 200, headers: HEADERS });
    }
  }

  if (req.method === 'POST') {
    let name, score, oranges;
    try {
      const body = await req.json();
      name    = String(body.name || '').trim().replace(/[^\x20-\x7E]/g, '').slice(0, MAX_NAME);
      score   = Math.floor(Number(body.score));
      oranges = Math.floor(Number(body.oranges) || 0);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: HEADERS });
    }

    if (!name) name = 'ANON';
    if (!Number.isFinite(score) || score < 0) {
      return new Response(JSON.stringify({ error: 'Invalid score' }), { status: 400, headers: HEADERS });
    }
    if (score > 100000000)   score = 100000000;   // sanity cap
    if (oranges > 1000000)   oranges = 1000000;
    if (!Number.isFinite(oranges) || oranges < 0) oranges = 0;

    try {
      const s     = store();
      const raw   = await s.get('scores', { consistency: 'strong' });
      const list  = clean(raw ? JSON.parse(raw) : []);
      const entry = { name, score, oranges, ts: Date.now() };
      list.push(entry);
      const sorted = clean(list);
      await s.set('scores', JSON.stringify(sorted));
      const rank = sorted.findIndex(e => e.ts === entry.ts && e.name === name && e.score === score) + 1;
      console.log('[scores-fn] POST name=' + name + ' score=' + score + ' rank=' + rank);
      return new Response(JSON.stringify({ rank, top: sorted.slice(0, TOP_RETURN) }), { status: 200, headers: HEADERS });
    } catch (e) {
      console.error('[scores-fn] POST error:', e.message || String(e));
      return new Response(JSON.stringify({ error: 'store' }), { status: 200, headers: HEADERS });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
};
