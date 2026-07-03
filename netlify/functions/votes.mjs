import { getStore } from '@netlify/blobs';

const VALID_TRACKS = ['twang-happy', 'desert-road', 'hidden-creek'];
const EMPTY_VOTES  = { 'twang-happy': 0, 'desert-road': 0, 'hidden-creek': 0 };

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json'
};

// consistency: 'strong' forces reads through uncachedEdgeURL instead of the
// CDN-cached edgeURL. Without it, writes persist but reads return stale data
// for up to ~60 seconds. Must be inside try/catch — getStore can throw if
// NETLIFY_BLOBS_CONTEXT is absent or malformed.
function store() {
  return getStore({ name: 'campaign-votes', consistency: 'strong' });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }

  if (req.method === 'GET') {
    try {
      const raw   = await store().get('votes');
      const votes = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      console.log('[votes-fn] GET returning:', JSON.stringify(votes));
      return new Response(JSON.stringify(votes), { status: 200, headers: HEADERS });
    } catch (e) {
      console.error('[votes-fn] GET error:', e.message || String(e));
      return new Response(JSON.stringify({ ...EMPTY_VOTES }), { status: 200, headers: HEADERS });
    }
  }

  if (req.method === 'POST') {
    let track;
    try {
      const body = await req.json();
      track = body.track;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: HEADERS });
    }

    if (!VALID_TRACKS.includes(track)) {
      return new Response(JSON.stringify({ error: 'Invalid track' }), { status: 400, headers: HEADERS });
    }

    try {
      const s     = store();
      const raw   = await s.get('votes');
      const votes = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      votes[track] = (votes[track] || 0) + 1;
      await s.set('votes', JSON.stringify(votes));
      console.log('[votes-fn] POST track=' + track + ' stored:', JSON.stringify(votes));
      return new Response(JSON.stringify(votes), { status: 200, headers: HEADERS });
    } catch (e) {
      console.error('[votes-fn] POST error:', e.message || String(e));
      return new Response(JSON.stringify({ ...EMPTY_VOTES }), { status: 200, headers: HEADERS });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
};
