// Local MCP client test: spawns the server over stdio and calls every tool.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const client = new Client({ name: 'local-test', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [new URL('../index.js', import.meta.url).pathname] }));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { text: r.content.map((c) => c.text).join('\n'), isError: !!r.isError };
};

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(tools, ['get_question', 'list_topics', 'random_question', 'search_questions']);

const topics = await call('list_topics');
assert.match(topics.text, /ai-engineer \(100 questions\)/);
assert.match(topics.text, /investment-banking \(100 questions\)/);

const s = await call('search_questions', { query: 'RAG chunking', track: 'ai-engineer', limit: 5 });
assert.match(s.text, /\[aie-\d+\]/);
assert.match(s.text, /aie-top-30-questions\?utm_source=mcp/);

const ib = await call('search_questions', { query: 'LBO returns', track: 'investment-banking', limit: 3 });
assert.match(ib.text, /\[ib-\d+\]/);
assert.match(ib.text, /ib-top-30-questions\?utm_source=mcp/);
assert.doesNotMatch(ib.text, /playbook/i, 'IB results link only the free IB Top 30');

const g = await call('get_question', { id: 'aie-1' });
assert.match(g.text, /transformer/i);
assert.match(g.text, /Model answer:/);
assert.match(g.text, /answer-check\/\?track=aie&q=explain-the-transformer-architecture&utm_source=mcp/);

const hidden = await call('get_question', { id: 'ib-30', reveal_answer: false });
assert.match(hidden.text, /Answer hidden/);
assert.doesNotMatch(hidden.text, /Model answer:/);

const bad = await call('get_question', { id: 'nope-1' });
assert.equal(bad.isError, true);

const r = await call('random_question', { track: 'investment-banking', topic: 'lbo' });
assert.match(r.text, /^ib-(7[1-9]|8[0-5]):/);

console.log('OK: 4 tools, all assertions passed');
console.log('\n--- sample get_question(aie-1) ---\n' + g.text.slice(0, 900));
await client.close();
