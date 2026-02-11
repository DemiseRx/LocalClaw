import http from 'node:http';

const phrase = process.env.LOCALCLAW_TEST_PHRASE ?? 'LOCAL_TEST_PHRASE';
const port = Number.parseInt(process.env.LOCALCLAW_TEST_PORT ?? '11434', 10);

const send = (res, code, payload) => {
  const data = Buffer.from(JSON.stringify(payload));
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': data.length });
  res.end(data);
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url?.startsWith('/v1/models')) {
    return send(res, 200, { object: 'list', data: [{ id: 'llama3.2:latest', object: 'model' }] });
  }

  if (req.method === 'POST' && (req.url?.startsWith('/v1/chat/completions') || req.url?.startsWith('/v1/responses'))) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let model = 'llama3.2:latest';
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      model = body.model || model;
    } catch {}

    if (req.url.startsWith('/v1/chat/completions')) {
      return send(res, 200, {
        id: 'cmpl-local-test', object: 'chat.completion', model,
        choices: [{ index: 0, message: { role: 'assistant', content: phrase }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      });
    }

    return send(res, 200, {
      id: 'resp-local-test', object: 'response', model,
      output: [{ id: 'msg-local-test', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: phrase }] }],
      usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
    });
  }

  return send(res, 404, { error: 'not found' });
});

server.listen(port, '127.0.0.1');
