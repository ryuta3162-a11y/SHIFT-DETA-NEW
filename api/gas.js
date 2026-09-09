const GAS_ENDPOINTS = [
  process.env.GAS_ENDPOINT,
  process.env.VITE_GAS_ENDPOINT,
  'https://script.google.com/macros/s/AKfycbxp0HBE4-akd-bbMFzvkaAbFiBkxlK-m8W7HugP9nkYx0LEs8kwu1sjdo54AABZuijv/exec',
  'https://script.google.com/a/macros/okamoto-group.co.jp/s/AKfycbxp0HBE4-akd-bbMFzvkaAbFiBkxlK-m8W7HugP9nkYx0LEs8kwu1sjdo54AABZuijv/exec',
].filter(Boolean);

function collectParams(req) {
  const params = new URLSearchParams();
  const sources = [];
  if (req.query && typeof req.query === 'object') sources.push(req.query);
  if (req.method === 'POST' && req.body && typeof req.body === 'object') sources.push(req.body);

  sources.forEach((source) => {
    Object.keys(source).forEach((key) => {
      if (key === 'callback') return;
      const value = source[key];
      if (value == null) return;
      params.set(key, Array.isArray(value) ? String(value[0]) : String(value));
    });
  });
  return params;
}

function toJsonBody(text) {
  const body = String(text || '').trim();
  if (!body) return null;
  if (body.startsWith('{') || body.startsWith('[')) return body;
  const matched = body.match(/^[a-zA-Z_$][\w$]*\(([\s\S]*)\);?\s*$/);
  if (matched) return matched[1];
  return null;
}

async function fetchGas(endpoint, params) {
  const url = `${endpoint}?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Accept: 'application/json,text/javascript,text/plain,*/*',
      'User-Agent': 'SHIFT-ONE-staff-pwa-proxy/1.0',
    },
  });
  const text = await response.text();
  const json = toJsonBody(text);
  if (!json) {
    throw new Error('unexpected gas response');
  }
  return json;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const params = collectParams(req);
    let lastError = null;
    for (const endpoint of GAS_ENDPOINTS) {
      try {
        const body = await fetchGas(endpoint, params);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).send(body);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    res.status(502).json({
      ok: false,
      message: (lastError && lastError.message) || '通信に失敗しました。もう一度お試しください。',
    });
  } catch {
    res.status(502).json({
      ok: false,
      message: '通信に失敗しました。もう一度お試しください。',
    });
  }
};
