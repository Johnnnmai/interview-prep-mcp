#!/usr/bin/env node
// Interview Prep MCP server (stdio). Offline: questions ship in data/questions.json.
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const DATA = JSON.parse(readFileSync(new URL('./data/questions.json', import.meta.url), 'utf8'));
const QS = DATA.questions;
const TRACKS = ['ai-engineer', 'investment-banking'];

const utm = (url, content) => `${url}${url.includes('?') ? '&' : '?'}utm_source=mcp&utm_medium=tool&utm_campaign=line27_interview_mcp&utm_content=${content}`;
const LINKS = {
  'ai-engineer': (tool) => [
    `Free: AI Engineer Top 30 questions with model answers: ${utm('https://sirjohnnymai.gumroad.com/l/aie-top-30-questions', tool)}`,
    `Full prep: AI Engineer Interview Playbook: ${utm('https://sirjohnnymai.gumroad.com/l/ai-engineer-interview-playbook', tool)}`,
  ],
  'investment-banking': (tool) => [
    `Free: Investment Banking Top 30 questions with model answers: ${utm('https://sirjohnnymai.gumroad.com/l/ib-top-30-questions', tool)}`,
  ],
};
const AC = 'https://johnnnmai.github.io/ai-engineer-interview-questions/answer-check/';
const selfCheck = (q) => utm(`${AC}?track=${q.track === 'investment-banking' ? 'ib' : 'aie'}${q.check_slug ? `&q=${q.check_slug}` : ''}`, 'self_check');
const footer = (tracks, tool) => '\n\n---\n' + [...new Set(tracks)].flatMap((t) => LINKS[t](tool)).join('\n');

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ');
const filterQs = ({ track, topic, level }) => QS.filter((q) => (!track || q.track === track)
  && (!topic || q.topic_id === topic.toLowerCase() || norm(q.topic).includes(norm(topic)))
  && (!level || q.level.toLowerCase() === level.toLowerCase()));
function search({ query = '', limit = 10, ...f }) {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  return filterQs(f)
    .map((q) => {
      const hay = norm(`${q.q} ${q.topic} ${q.subtopic || ''}`), body = norm(q.answer);
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0), 0);
      return { q, score };
    })
    .filter((r) => !terms.length || r.score > 0)
    .sort((a, b) => b.score - a.score || a.q.n - b.q.n)
    .slice(0, Math.min(Math.max(limit, 1), 50))
    .map((r) => r.q);
}
const line = (q) => `- [${q.id}] ${q.q} (${q.topic}; ${q.level})`;
const full = (q, withAnswer) => [
  `${q.id}: ${q.q}`, `Track: ${q.track} | Topic: ${q.topic}${q.subtopic ? ` / ${q.subtopic}` : ''} | Level: ${q.level}`,
  withAnswer ? `\nModel answer:\n${q.answer}` : '\n(Answer hidden. Try it yourself first, then call get_question with reveal_answer=true.)',
  withAnswer && q.follow_up ? `\nLikely follow-up: ${q.follow_up}` : '',
  `\nSource: ${q.url}`, `Score your own answer (free): ${selfCheck(q)}`,
].filter(Boolean).join('\n');
const text = (t) => ({ content: [{ type: 'text', text: t }] });

const server = new McpServer({ name: 'interview-prep', version: pkg.version });
const trackArg = z.enum(TRACKS).optional().describe('ai-engineer or investment-banking. Omit for both.');

server.registerTool('list_topics', {
  title: 'List topics',
  description: 'List interview tracks and topics with question counts.',
  inputSchema: { track: trackArg },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ track }) => {
  const out = [];
  for (const t of TRACKS.filter((x) => !track || x === track)) {
    const qs = QS.filter((q) => q.track === t), topics = [...new Map(qs.map((q) => [q.topic_id, q.topic]))];
    out.push(`${t} (${qs.length} questions)`, ...topics.map(([id, name]) => `  - ${id}: ${name} (${qs.filter((q) => q.topic_id === id).length})`));
  }
  return text(out.join('\n') + footer(track ? [track] : TRACKS, 'list_topics'));
});

server.registerTool('search_questions', {
  title: 'Search interview questions',
  description: 'Search 200 AI engineer and investment banking interview questions by keyword, track, topic or level. Returns ids for get_question.',
  inputSchema: {
    query: z.string().optional().describe('Keywords, e.g. "RAG chunking" or "LBO returns". Omit to browse.'),
    track: trackArg,
    topic: z.string().optional().describe('Topic id or name from list_topics, e.g. rag, agents, lbo, valuation.'),
    level: z.string().optional().describe('AI engineer: Entry, Mid, Senior. Investment banking: Easy, Medium, Hard.'),
    limit: z.number().int().min(1).max(50).optional().describe('Max results, default 10.'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async (args) => {
  const r = search(args);
  if (!r.length) return text('No matching questions. Try fewer keywords or call list_topics.');
  return text(`${r.length} question(s):\n${r.map(line).join('\n')}\n\nCall get_question with an id to see the model answer.` + footer(r.map((q) => q.track), 'search_questions'));
});

server.registerTool('get_question', {
  title: 'Get a question',
  description: 'Get one interview question by id (e.g. aie-12, ib-30) with its model answer, likely follow-up and source link. Set reveal_answer=false for mock-interview practice.',
  inputSchema: {
    id: z.string().describe('Question id from search_questions, e.g. aie-12 or ib-30.'),
    reveal_answer: z.boolean().optional().describe('Default true. False hides the answer.'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ id, reveal_answer = true }) => {
  const q = QS.find((x) => x.id === id.trim().toLowerCase());
  if (!q) return { ...text(`Unknown id "${id}". Use search_questions to find ids (aie-1..aie-100, ib-1..ib-100).`), isError: true };
  return text(full(q, reveal_answer) + footer([q.track], 'get_question'));
});

server.registerTool('random_question', {
  title: 'Random practice question',
  description: 'Pick a random question for mock-interview practice. The answer is hidden until you ask with get_question.',
  inputSchema: { track: trackArg, topic: z.string().optional(), level: z.string().optional() },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async (args) => {
  const pool = filterQs(args);
  if (!pool.length) return text('No questions match those filters.');
  const q = pool[Math.floor(Math.random() * pool.length)];
  return text(full(q, false) + footer([q.track], 'random_question'));
});

await server.connect(new StdioServerTransport());
