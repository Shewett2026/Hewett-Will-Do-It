import { getStore } from '@netlify/blobs';

const VALID_TRACKS = ['twang-happy', 'desert-road', 'hidden-creek'];
const EMPTY_VOTES  = { 'twang-happy': 0, 'desert-road': 0, 'hidden-creek': 0 };

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'no-store'
};

// Use string form of getStore (never throws on init) and apply
// consistency: 'strong' per-operation on reads so every get() bypasses
// the CDN edge cache and hits the origin. Store-level consistency via the
// object form was not reliably applying in v7.4.0, causing reads to return
// null and every POST to start from EMPTY_VOTES (last vote wins at 100%).
function store() {
  return getStore('campaign-votes');
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }

  if (req.method === 'GET') {
    try {
      const raw   = await store().get('votes', { consistency: 'strong' });
      const votes = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      console.log('[votes-fn] GET returning:', JSON.stringify(votes));
      return new Response(JSON.stringify(votes), { status: 200, headers: HEADERS });
    } catch (e) {
      console.error('[votes-fn] GET error:', e.message || String(e));
      return new Response(JSON.stringify({ ...EMPTY_VOTES }), { status: 200, headers: HEADERS });
    }
  }

  if (req.method === 'POST') {
    let track, previousTrack;
    try {
      const body  = await req.json();
      track         = body.track;
      previousTrack = body.previousTrack || null;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: HEADERS });
    }

    if (!VALID_TRACKS.includes(track)) {
      return new Response(JSON.stringify({ error: 'Invalid track' }), { status: 400, headers: HEADERS });
    }
    if (previousTrack && !VALID_TRACKS.includes(previousTrack)) {
      return new Response(JSON.stringify({ error: 'Invalid previousTrack' }), { status: 400, headers: HEADERS });
    }

    try {
      const s     = store();
      const raw   = await s.get('votes', { consistency: 'strong' });
      const votes = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };

      // When changing an existing vote: decrement the old track (floor 0),
      // increment the new one — total vote count stays the same.
      if (previousTrack && previousTrack !== track) {
        votes[previousTrack] = Math.max(0, (votes[previousTrack] || 0) - 1);
      }
      votes[track] = (votes[track] || 0) + 1;

      await s.set('votes', JSON.stringify(votes));
      const logTag = previousTrack ? ' (changed from ' + previousTrack + ')' : '';
      console.log('[votes-fn] POST track=' + track + logTag + ' stored:', JSON.stringify(votes));
      return new Response(JSON.stringify(votes), { status: 200, headers: HEADERS });
    } catch (e) {
      console.error('[votes-fn] POST error:', e.message || String(e));
      return new Response(JSON.stringify({ ...EMPTY_VOTES }), { status: 200, headers: HEADERS });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
};
