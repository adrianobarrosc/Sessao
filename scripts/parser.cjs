/* ---------- Parser das páginas do Notion ---------- */
const SOURCES = [
  { key: 'filmes',    label: 'Filmes',    icon: '🎥', id: '379c3aaf02db4d08a945ca336ca82151', pathMode: 'full'  },
  { key: 'streaming', label: 'Séries',    icon: '📺', id: '4a59fdaba12b483d8c02659818679d0b', pathMode: 'last'  },
  { key: 'leitura',   label: 'Leitura',   icon: '📚', id: 'd0063945369b467daf1cafdd932bd141', pathMode: 'full'  },
  { key: 'games',     label: 'Games',     icon: '🕹️', id: 'ad4f3949ae174dad9ada362a2c0dc13c', pathMode: 'full'  },
];

const GENRES = [
  ['Ação',              /\ba[çc][ãa]o\b|hack and slash|beat ?[’']?em up|artes marciais|vingan[çc]a|shooter|fps\b|battle royale/i],
  ['Aventura',          /aventura|adventure|explora[çc]|road movie/i],
  ['Comédia',           /com[ée]dia|humor|s[áa]tir|parod|tragicom|mockument|cringe|tira c[ôo]mica/i],
  ['Drama',             /drama/i],
  ['Romance',           /romance(?! (hist|polic|liter|psicol|epistol|sombrio|fant))|rom[âa]ntic|romantasia|\bamor\b/i],
  ['Ficção literária',  /fic[çc][ãa]o (contempor|liter|brasileira)|romance (liter|psicol|epistol)|novela/i],
  ['Ficção científica', /fic[çc][ãa]o cient|sci-?fi|space western|dist[óo]p|p[óo]s-apocal|cyberpunk|futurist|mecha|multiverso/i],
  ['Fantasia',          /fantasi|fantasy|realismo m[áa]gico|mitol[óo]g|sobrenatural|surreal/i],
  ['Suspense',          /suspense|thriller/i],
  ['Crime & policial',  /crime|criminal|policial|pol[íi]cia|true crime|heist|m[áa]fia|g[âa]ngster|noir|assalto|golpe/i],
  ['Mistério',          /mist[ée]rio|detetive|investiga|whodunit/i],
  ['Terror',            /terror|horror/i],
  ['Animação & anime',  /anima[çc][ãa]o|\banime\b|animated/i],
  ['Documentário',      /document[áa]rio|docuss[ée]rie/i],
  ['Biografia',         /biogra|mem[óo]rias|fatos reais|hist[óo]ria real/i],
  ['Histórico & guerra',/hist[óo]ric|guerra\b|\bwar\b|medieval|de [ée]poca/i],
  ['Faroeste',          /faroeste|western|ocidental\)/i],
  ['Música & musical',  /musical|m[úu]sica|ritmo/i],
  ['Esporte',           /esporte|futebol|\bsport|basquete|f[óo]rmula 1/i],
  ['Política & jurídico',/pol[íi]tic|jur[íi]dic|advoga|democracia/i],
  ['Super-heróis',      /super-?her[óo][íi]/i],
  ['Espionagem',        /espionagem|espi[ãa]/i],
  ['Juventude & família',/fam[íi]lia|infantil|coming-of-age|adolesc|juvenil|\bteen\b/i],
  ['Quadrinhos',        /quadrinh|\bhq\b|graphic novel|mang[áa]|tira c[ôo]mica/i],
  ['Ensaio & não ficção', /reportagem|jornalis|hist[óo]ria cultural|cultura pop|hist[óo]ria da|cr[ôo]nica|ci[êe]ncia|ensaio|filosof|economia|sociolog|estat[íi]stic|dados|tecnolog|antropolog|atualidades|pol[íi]tica|psicolog/i],
  ['Negócios & produtividade', /produtividade|neg[óo]cio|marketing|lideran[çc]a|gest[ãa]o|carreira|criatividade|empreend|escrita/i],
  ['Bem-estar & estilo de vida', /autoajuda|bem-estar|sa[úu]de|culin[áa]ri|gastronom|espiritual|estilo de vida|longevidade|medita/i],
  ['Clássicos',         /cl[áa]ssico/i],
  ['RPG',               /\brpg\b|jrpg|\bmmo\b/i],
  ['Tiro',              /\bfps\b|shooter|tiro\b|battle royale/i],
  ['Plataforma',        /plataforma|metroidvania/i],
  ['Luta',              /\bluta\b|fighting|brawler/i],
  ['Corrida',           /corrida|\bkart|racing|drift/i],
  ['Estratégia',        /estrat[ée]g|\b4x\b|t[áa]tic|board game|tower/i],
  ['Puzzle',            /puzzle|quebra-cabe|l[óo]gica|palavras/i],
  ['Simulação',         /simula/i],
  ['Party & casual',    /\bparty\b|casual|arcade|cartas|pinball|cooperativo/i],
  ['Roguelike',         /roguelike|roguelite/i],
  ['Sobrevivência',     /sobreviv|survival/i],
];
const GAME_ONLY = new Set(['RPG','Tiro','Plataforma','Luta','Corrida','Estratégia','Puzzle','Simulação','Party & casual','Roguelike','Sobrevivência']);
const BOOK_ONLY = new Set(['Ficção literária','Ensaio & não ficção','Negócios & produtividade','Bem-estar & estilo de vida','Quadrinhos','Clássicos']);

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function clean(s) {
  if (!s) return '';
  s = s.replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, '');      // "([Wikipedia](url))"
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');            // [txt](url)
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\\([*_|#\[\]()])/g, '$1');
  s = s.replace(/\*\*/g, '');
  return decode(s).replace(/\s+/g, ' ').trim();
}
const norm = s => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function splitPipeRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  const cells = []; let cur = ''; let depth = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\' && t[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '<') depth++; else if (c === '>') depth = Math.max(0, depth - 1);
    if (c === '|' && depth === 0) { cells.push(cur); cur = ''; } else cur += c;
  }
  cells.push(cur);
  return cells.map(x => x.trim());
}

function rowsFromHtmlTable(block) {
  const rows = [];
  const trRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/g; let m;
  while ((m = trRe.exec(block))) {
    const cells = []; const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>|<t[dh][^>]*\/>/g; let c;
    while ((c = tdRe.exec(m[2]))) cells.push((c[1] || '').trim());
    const color = (m[1].match(/color="([^"]+)"/) || [])[1] || null;
    rows.push({ cells, color });
  }
  return rows;
}

/** Converte o texto de uma página em blocos ordenados: headings, rótulos e tabelas */
function tokenize(text) {
  let t = text;
  const ci = t.indexOf('<content>'); if (ci >= 0) t = t.slice(ci + 9);
  const ce = t.lastIndexOf('</content>'); if (ce >= 0) t = t.slice(0, ce);
  // <h1 ...>\n texto \n</h1>  ->  "# texto"
  t = t.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g, (_, n, inner) => '\n' + '#'.repeat(+n) + ' ' + clean(inner) + '\n');
  const toks = [];
  // separa tabelas HTML primeiro
  const parts = t.split(/(<table[\s\S]*?<\/table>)/g);
  for (const part of parts) {
    if (part.startsWith('<table')) { toks.push({ type: 'table', rows: rowsFromHtmlTable(part) }); continue; }
    const lines = part.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { const txt = clean(h[2]); if (txt) toks.push({ type: 'h', level: h[1].length, text: txt }); continue; }
      if (/^\s*\|/.test(line)) {
        const block = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
        i--;
        const rows = block.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)).map(l => ({ cells: splitPipeRow(l), color: null }));
        toks.push({ type: 'table', rows });
        continue;
      }
      if (/<u>/.test(line)) {
        const txt = clean(line).replace(/:\s*$/, '');
        if (txt && txt.length <= 40) toks.push({ type: 'label', text: txt });
      }
    }
  }
  return toks;
}

const TITLE_HDR = /^(t[íi]tulo( no brasil| em portugu[êe]s| da s[ée]rie)?|jogo.*|nome( original)?|hist[óo]ria)$/i;
const GENRE_HDR = /g[êe]nero/i;
const SKIP_DETAIL_HDR = /^n[ºo°]\.?$/i;

function parsePage(src, text, pageUrl) {
  const toks = tokenize(text);
  const items = [];
  const heads = [];          // heads[level-1]
  let label = '';
  for (const tk of toks) {
    if (tk.type === 'h') { heads[tk.level - 1] = tk.text; heads.length = tk.level; label = ''; continue; }
    if (tk.type === 'label') { label = tk.text; continue; }
    if (tk.type !== 'table' || tk.rows.length < 2) continue;
    const header = tk.rows[0].cells.map(clean);
    const hs = heads.filter(Boolean);
    let path = src.pathMode === 'last' ? (hs.length ? [hs[hs.length - 1]] : []) : hs.slice();
    if (label) path = path.concat(label);
    let titleIdx = header.findIndex(h => /^t[íi]tulo( no brasil| em portugu[êe]s)$/i.test(h));
    if (titleIdx < 0) titleIdx = header.findIndex(h => TITLE_HDR.test(h));
    let last = null;
    for (const row of tk.rows.slice(1)) {
      const raw = row.cells;
      const nonEmpty = raw.map((c, i) => [i, c]).filter(([, c]) => clean(c));
      if (!nonEmpty.length) continue;
      // linha de sinopse: uma única célula preenchida, em itálico
      if (nonEmpty.length === 1 && last && (/<i>/.test(nonEmpty[0][1]) || nonEmpty[0][0] !== titleIdx)) {
        const syn = clean(nonEmpty[0][1]).replace(/\s*\(Repetido do n[ºo] ?\d+\.?\)\s*$/i, '');
        last.synopsis = last.synopsis ? last.synopsis : syn;
        continue;
      }
      // título: célula em negrito, senão a coluna de título
      let ti = titleIdx >= 0 && clean(raw[titleIdx]) ? titleIdx : raw.findIndex(c => /^\s*<b>/.test(c));
      if (ti < 0) ti = 0;
      const title = clean(raw[ti]);
      if (!title) continue;
      const fields = [];
      let genreText = '';
      header.forEach((h, i) => {
        if (i === ti || !h || SKIP_DETAIL_HDR.test(h)) return;
        const v = clean(raw[i] || '');
        if (!v) return;
        fields.push([h, v]);
        if (GENRE_HDR.test(h)) genreText += ' / ' + v;
      });
      // subtítulo: original / autor / diretor
      const pick = re => (fields.find(([h]) => re.test(h)) || [])[1] || '';
      const original = pick(/t[íi]tulo original|nome original/i);
      const creator = pick(/autor|diretor|criador/i);
      const year = pick(/^ano$/i);
      const item = {
        media: src.key, title, original: original && norm(original) !== norm(title) ? original : '',
        creator, year, path, fields, synopsis: '', genreText: genreText.replace(/^ \/ /, ''),
        flag: row.color, url: pageUrl,
      };
      items.push(item); last = item;
    }
  }
  return dedupe(items).map(it => Object.assign(it, { genres: canonGenres(it) }));
}

function dedupe(items) {
  const map = new Map();
  for (const it of items) {
    const k = it.media + '|' + norm(it.title);
    if (!map.has(k)) { it.lists = [it.path.join(' › ')]; map.set(k, it); continue; }
    const a = map.get(k);
    const p = it.path.join(' › ');
    if (!a.lists.includes(p)) a.lists.push(p);
    if (!a.synopsis && it.synopsis) a.synopsis = it.synopsis;
    for (const f of it.fields) if (!a.fields.some(([h]) => h === f[0])) a.fields.push(f);
    if (!a.genreText) a.genreText = it.genreText;
  }
  return [...map.values()];
}

function canonGenres(it) {
  const allowed = g => it.media === 'games' ? !BOOK_ONLY.has(g) : it.media === 'leitura' ? !GAME_ONLY.has(g) : !GAME_ONLY.has(g) && !BOOK_ONLY.has(g);
  const match = txt => GENRES.filter(([g, re]) => allowed(g) && re.test(txt)).map(([g]) => g);
  let gs = match(it.genreText);
  if (it.media === 'leitura' && /hqs/i.test(it.path.join(' '))) gs.push('Quadrinhos');
  if (!gs.length) gs = match(it.fields.map(f => f[1]).join(' / ') + ' / ' + it.path.join(' / '));
  // Tiro já implica Ação em games; evita duplicar "Ação" vindo só de "shooter"
  return [...new Set(gs)];
}

if (typeof module !== 'undefined') module.exports = { parsePage, SOURCES, tokenize, GENRES };
