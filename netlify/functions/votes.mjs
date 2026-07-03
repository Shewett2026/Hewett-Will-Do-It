// Netlify Functions v2 — diagnostic build.
// Reads NETLIFY_BLOBS_CONTEXT details and does a same-invocation readback
// after every set() to isolate where persistence breaks.

import { getStore } from '@netlify/blobs';

const VALID_TRACKS = ['twang-happy', 'desert-road', 'hidden-creek'];
const EMPTY_VOTES  = { 'twang-happy': 0, 'desert-road': 0, 'hidden-creek': 0 };

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json'
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS });
  }

  // Decode context metadata (no secrets exposed — just structural info)
  const rawCtx = process.env.NETLIFY_BLOBS_CONTEXT || '';
  let ctxInfo = { present: !!rawCtx, len: rawCtx.length, keys: [] };
  if (rawCtx) {
    try {
      const decoded = JSON.parse(Buffer.from(rawCtx, 'base64').toString('utf8'));
      ctxInfo.keys = Object.keys(decoded);
      ctxInfo.apiURL = decoded.apiURL || '(none)';
      ctxInfo.siteID = decoded.siteID || '(none)';
      ctxInfo.hasToken = !!decoded.token;
    } catch (e) {
      ctxInfo.parseErr = e.message;
    }
  }

  if (req.method === 'GET') {
    try {
      const store = getStore('campaign-votes');
      const raw   = await store.get('votes');
      const votes = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      return new Response(JSON.stringify({ ...votes, _ctx: ctxInfo }), { status: 200, headers: HEADERS });
    } catch (e) {
      return new Response(JSON.stringify({ ...EMPTY_VOTES, _ctx: ctxInfo, _err: (e.message || String(e)).slice(0, 300) }), { status: 200, headers: HEADERS });
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
      const store  = getStore('campaign-votes');
      const raw    = await store.get('votes');
      const votes  = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      votes[track] = (votes[track] || 0) + 1;

      // Write
      await store.set('votes', JSON.stringify(votes));

      // Immediately read back from the SAME store object to see if the write "took"
      const rawBack  = await store.get('votes');
      const readback = rawBack ? JSON.parse(rawBack) : null;

      return new Response(JSON.stringify({
        written:  votes,
        readback: readback,
        readback_matches: JSON.stringify(readback) === JSON.stringify(votes),
        _ctx: ctxInfo
      }), { status: 200, headers: HEADERS });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e.message || String(e)).slice(0, 300), _ctx: ctxInfo }), { status: 200, headers: HEADERS });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
};
