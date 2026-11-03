// Rebuilds data/questions.json from the two public GitHub Pages question banks.
// Run: npm run build:data   (network needed only here, never at server runtime)
import { writeFileSync } from 'node:fs';

const SITES = {
  'ai-engineer': 'https://johnnnmai.github.io/ai-engineer-interview-questions/',
  'investment-banking': 'https://johnnnmai.github.io/investment-banking-interview-questions/',
};
const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', ndash: '\u2013', mdash: '-', hellip: '...' };
const text = (h) => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => ent[e] ?? (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : m))
  .replace(/\u2014/g, '-').replace(/[ \t]+/g, ' ').trim();
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function get(u) { const r = await fetch(u); if (!r.ok) throw new Error(`${u} -> ${r.status}`); return r.text(); }

// Deep-dive pages: slug -> question title taken from the page's own <h1>.
async function deepDives(base) {
  const sm = await get(base + 'sitemap.xml');
  const slugs = [...new Set([...sm.matchAll(/\/questions\/([a-z0-9-]+)\/</g)].map((m) => m[1]))];
  const out = [];
  for (const slug of slugs) {
    const h = await get(`${base}questions/${slug}/`);
    const h1 = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    out.push({ slug, title: h1 ? text(h1[1]) : slug.replace(/-/g, ' ') });
  }
  return out;
}
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const STOP = new Set(['the', 'and', 'what', 'how', 'why', 'you', 'your', 'does', 'for', 'with', 'are', 'when', 'would', 'walk', 'through', 'explain', 'interview', 'question', 'answer']);
function bestDive(q, dives) {
  const a = words(q); let best = null, score = 0;
  for (const d of dives) {
    const b = words(d.title); const inter = [...a].filter((w) => b.has(w)).length;
    const j = inter / (a.size + b.size - inter || 1);
    if (j > score) { score = j; best = d; }
  }
  return score >= 0.5 ? best : null;
}

async function aie(base) {
  const html = await get(base), dives = await deepDives(base), out = [];
  const sections = [...html.matchAll(/<h2 id=(\w+)>([^<]+)/g)].map((m) => ({ id: m[1], name: text(m[2]), at: m.index }));
  for (const m of html.matchAll(/<details class=q id=q(\d+)><summary><span class='lvl \w+'>([^<]+)<\/span>\d+\.\s*([\s\S]*?)<\/summary><div class=qa>([\s\S]*?)<\/div><\/details>/g)) {
    const sec = sections.filter((s) => s.at < m.index).pop();
    const ans = [...m[4].matchAll(/<p class=ans>([\s\S]*?)<\/p>/g)].map((x) => text(x[1])).join('\n\n');
    const fu = m[4].match(/<div class=fu><b>Likely follow-up:<\/b>([\s\S]*?)<\/div>/);
    out.push({ n: +m[1], q: text(m[3]), level: text(m[2]), topic: sec?.name || '', topic_id: sec?.id || '', answer: ans, follow_up: fu ? text(fu[1]) : '', anchor: base + '#q' + m[1] });
  }
  return { out, dives };
}

async function ib(base) {
  const html = await get(base), dives = await deepDives(base), out = [];
  const sections = [...html.matchAll(/<h2 id="([^"]+)">([^<]+)/g)].map((m) => ({ id: m[1], name: text(m[2]).replace(/\s*\(\d+-\d+\)/, ''), at: m.index }));
  const parts = [...html.matchAll(/<h3 id="(\d+)-([^"]+)">\d+\.\s*([\s\S]*?)<\/h3>/g)];
  parts.forEach((m, i) => {
    const end = i + 1 < parts.length ? parts[i + 1].index : html.indexOf('<h2', m.index);
    const body = html.slice(m.index + m[0].length, end);
    const meta = body.match(/<p><em>([^<]+)<\/em><\/p>/);
    const [cat, level] = meta ? text(meta[1]).split(/\s*·\s*/) : ['', ''];
    const fu = body.match(/<blockquote>\s*<p>Follow-up:\s*([\s\S]*?)<\/p>/);
    const paras = [...body.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, '').matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => text(x[1])).filter((t, j) => !(j === 0 && meta));
    const sec = sections.filter((s) => s.at < m.index).pop();
    out.push({ n: +m[1], q: text(m[3]), level: level || '', topic: sec?.name || '', topic_id: slugify(sec?.name || ''), subtopic: cat || '', answer: paras.join('\n\n'), follow_up: fu ? text(fu[1]) : '', anchor: base + '#' + m[1] + '-' + m[2] });
  });
  return { out, dives };
}

// Free self-check page: which deep-dive slugs it can score, per track.
const AC = 'https://johnnnmai.github.io/ai-engineer-interview-questions/answer-check/';
const acHtml = await get(AC);
const acData = JSON.parse(acHtml.match(/id=["']?ac-data["']?>([\s\S]*?)<\/script>/)[1]);
const acSlugs = { 'ai-engineer': new Set(acData.tracks.aie.questions.map((q) => q.slug)), 'investment-banking': new Set(acData.tracks.ib.questions.map((q) => q.slug)) };

const all = [];
for (const [track, base] of Object.entries(SITES)) {
  const { out, dives } = track === 'ai-engineer' ? await aie(base) : await ib(base);
  if (out.length < 90) throw new Error(`${track}: parsed only ${out.length} questions; markup changed?`);
  for (const r of out) {
    const dive = bestDive(r.q, dives);
    all.push({ id: `${track === 'ai-engineer' ? 'aie' : 'ib'}-${r.n}`, track, ...r, url: dive ? `${base}questions/${dive.slug}/` : r.anchor, check_slug: dive && acSlugs[track].has(dive.slug) ? dive.slug : null });
  }
}
writeFileSync(new URL('../data/questions.json', import.meta.url), JSON.stringify({ built_at: new Date().toISOString(), sources: SITES, questions: all }, null, 1) + '\n');
console.log(`wrote ${all.length} questions`, Object.fromEntries(Object.keys(SITES).map((t) => [t, all.filter((q) => q.track === t).length])));
