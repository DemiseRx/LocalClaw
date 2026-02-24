import http from 'node:http';

const port = Number.parseInt(process.env.LOCAL_WEB_SEARCH_PORT ?? '8787', 10);
const host = process.env.LOCAL_WEB_SEARCH_HOST ?? '127.0.0.1';

const decode = (s) => s
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const extractResults = (html) => {
  const results = [];
  const regex = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>(.*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null && results.length < 6) {
    const href = decode(m[1]);
    const title = decode(m[2].replace(/<[^>]+>/g, '').trim());
    if (!href || !title) continue;
    results.push({ title, url: href });
  }
  return results;
};

const searchWeb = async (query) => {
  const fixture = process.env.LOCAL_SEARCH_FIXTURE?.trim();
  if (fixture) {
    return fixture.split('|').map((x, i) => ({ title: x.trim() || `Result ${i + 1}`, url: `https://example.com/${i + 1}` })).slice(0, 6);
  }

  const endpoint = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(endpoint, {
    headers: { 'user-agent': 'LocalClaw-Search-Proxy/1.0' },
  });
  if (!res.ok) throw new Error(`Search fetch failed (${res.status})`);
  const html = await res.text();
  const items = extractResults(html);
  if (!items.length) throw new Error('No results parsed from local search source');
  return items;
};

const send = (res, status, payload) => {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': body.length });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/chat/completions') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      return send(res, 400, { error: 'invalid_json' });
    }

    const model = String(body.model ?? 'local-search-proxy');
    const query = String(body?.messages?.[0]?.content ?? '').trim();
    if (!query) return send(res, 400, { error: 'missing_query' });

    try {
      const items = await searchWeb(query);
      const citations = items.map((x) => x.url);
      const content = items.map((x, i) => `${i + 1}. ${x.title} — ${x.url}`).join('\n');
      return send(res, 200, {
        id: 'chatcmpl-local-search',
        object: 'chat.completion',
        model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        citations,
      });
    } catch (err) {
      return send(res, 500, { error: String(err?.message ?? err) });
    }
  }

  return send(res, 404, { error: 'not_found' });
});

server.listen(port, host, () => {
  console.log(`[LocalClaw] local-web-search-proxy listening on http://${host}:${port}`);
});
