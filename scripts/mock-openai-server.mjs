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
    return send(res, 200, {
      object: 'list',
      data: [
        { id: 'lfm2.5-1.2b', object: 'model' },
        { id: 'liquid/lfm2.5-1.2b', object: 'model' },
        { id: 'liquid/lfm2-1.2b', object: 'model' },
        { id: 'llama3.2:latest', object: 'model' },
      ],
    });
  }

  if (req.method === 'POST' && (req.url?.startsWith('/v1/chat/completions') || req.url?.startsWith('/v1/responses'))) {
    const chunks = [];
    for await (const c of req) chunks.push(c);

    let model = 'lfm2.5-1.2b';
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      model = body.model || model;
    } catch {}

    const requestedTools = Array.isArray(body.tools) && body.tools.length > 0;

    if (req.url.startsWith('/v1/chat/completions')) {
      if (requestedTools) {
        return send(res, 200, {
          id: 'cmpl-local-test-tool',
          object: 'chat.completion',
          model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_local_1',
                type: 'function',
                function: {
                  name: 'local_lookup',
                  arguments: JSON.stringify({ query: 'health' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 6, completion_tokens: 4, total_tokens: 10 },
        });
      }

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
