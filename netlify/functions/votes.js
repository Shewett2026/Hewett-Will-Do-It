const { getStore } = require('@netlify/blobs');

const VALID_TRACKS = ['twang-happy', 'desert-road', 'hidden-creek'];

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json'
};

const EMPTY_VOTES = { 'twang-happy': 0, 'desert-road': 0, 'hidden-creek': 0 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  if (event.httpMethod === 'GET') {
    try {
      const store = getStore('campaign-votes');
      const raw   = await store.get('votes');
      const votes = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      console.log('[votes-fn] GET returning:', JSON.stringify(votes));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(votes) };
    } catch (e) {
      console.error('[votes-fn] GET error:', e.message || String(e));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ...EMPTY_VOTES }) };
    }
  }

  if (event.httpMethod === 'POST') {
    let track;
    try {
      track = JSON.parse(event.body || '{}').track;
    } catch (e) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (!VALID_TRACKS.includes(track)) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid track' }) };
    }

    try {
      const store  = getStore('campaign-votes');
      const raw    = await store.get('votes');
      const votes  = raw ? JSON.parse(raw) : { ...EMPTY_VOTES };
      votes[track] = (votes[track] || 0) + 1;
      await store.set('votes', JSON.stringify(votes));
      console.log('[votes-fn] POST track=' + track + ' stored:', JSON.stringify(votes));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(votes) };
    } catch (e) {
      console.error('[votes-fn] POST error:', e.message || String(e));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ...EMPTY_VOTES }) };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
