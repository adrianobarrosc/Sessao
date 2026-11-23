// Lê as páginas Filmes, Streaming, Leitura e Games no Notion e gera data.json.
// Uso: NOTION_TOKEN=secret_xxx node scripts/build-data.mjs
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { parsePage, SOURCES } = require('./parser.cjs');

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) { console.error('Defina NOTION_TOKEN.'); process.exit(1); }
const API = 'https://api.notion.com/v1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function children(id) {
  const out = []; let cursor;
  do {
    const url = `${API}/blocks/${id}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`;
    let res;
    for (let tent = 0; tent < 4; tent++) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28' } });
      if (res.status !== 429 && res.status < 500) break;
      await sleep(1500 * (tent + 1));
    }
    if (!res.ok) throw new Error(`Notion ${res.status} em ${id}: ${await res.text()}`);
    const j = await res.json();
    out.push(...j.results); cursor = j.has_more ? j.next_cursor : null;
    await sleep(350);
  } while (cursor);
  return out;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rich(arr = []) {
  return arr.map(t => {
    let s = esc(t.plain_text || '');
    if (t.annotations?.italic) s = `<i>${s}</i>`;
    if (t.annotations?.bold) s = `<b>${s}</b>`;
    if (t.annotations?.underline) s = `<u>${s}</u>`;
    return s;
  }).join('');
}
const plain = arr => (arr || []).map(t => t.plain_text).join('');

const CONTAINERS = new Set(['column_list', 'column', 'toggle', 'callout', 'synced_block', 'quote', 'bulleted_list_item', 'numbered_list_item']);
async function render(id, depth = 0) {
  const lines = [];
  for (const b of await children(id)) {
    const t = b.type;
    if (/^heading_[123]$/.test(t)) {
      lines.push('#'.repeat(+t.slice(-1)) + ' ' + plain(b[t].rich_text));
      if (b.has_children) lines.push(await render(b.id, depth + 1));
    } else if (t === 'paragraph') {
      const r = rich(b.paragraph.rich_text);
      if (r.includes('<u>')) lines.push(r);
    } else if (t === 'table') {
      const rows = await children(b.id);
      lines.push('<table header-row="true">');
      for (const row of rows) {
        if (row.type !== 'table_row') continue;
        lines.push('<tr>' + row.table_row.cells.map(c => `<td>${rich(c)}</td>`).join('') + '</tr>');
      }
      lines.push('</table>');
    } else if (CONTAINERS.has(t) && b.has_children && depth < 4) {
      lines.push(await render(b.id, depth + 1));
    }
  }
  return lines.join('\n');
}

const previous = existsSync('data.json') ? JSON.parse(readFileSync('data.json', 'utf8')) : { sources: {} };
const out = { generatedAt: new Date().toISOString(), sources: {} };
let failures = 0;
for (const src of SOURCES) {
  try {
    const text = await render(src.id);
    const items = parsePage(src, text, 'https://www.notion.so/' + src.id);
    if (!items.length) throw new Error('nenhuma tabela reconhecida');
    out.sources[src.key] = { items };
    console.log(`${src.label}: ${items.length} títulos`);
  } catch (e) {
    failures++;
    console.error(`${src.label}: ${e.message} — mantendo a cópia anterior`);
    if (previous.sources?.[src.key]) out.sources[src.key] = previous.sources[src.key];
  }
}
writeFileSync('data.json', JSON.stringify(out));
if (failures === SOURCES.length) process.exit(1);
