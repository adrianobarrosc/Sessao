// Capas e resumos de livros (Google Books + Open Library) e jogos (IGDB).
// Só consulta títulos ainda sem dados: o que já foi encontrado é reaproveitado da cópia anterior.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = x => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'e').replace(/[^a-z0-9]+/g, ' ').trim();
const stripHtml = s => (s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+\n/g, '\n').trim();
const VERSION = 1;

async function getJson(url, opts = {}) {
  for (let tent = 0; tent < 4; tent++) {
    const res = await fetch(url, opts);
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (tent + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} em ${url.split('?')[0]}`);
    return res.json();
  }
  throw new Error('serviço indisponível: ' + url.split('?')[0]);
}

function reuse(items, previousItems) {
  const prev = new Map((previousItems || []).filter(i => i.visual?.v === VERSION).map(i => [norm(i.title), i]));
  const todo = [];
  for (const it of items) {
    const p = prev.get(norm(it.title));
    if (p) { it.visual = p.visual; if (p.extSummary && !it.synopsis) it.extSummary = p.extSummary; }
    else todo.push(it);
  }
  return todo;
}

// ---------- Livros ----------
const firstAuthor = a => (a || '').replace(/\([^)]*\)/g, '').split(/;|,| e | and /)[0].trim();
const cleanTitle = t => t.replace(/\([^)]*\)/g, '').replace(/^(trilogia|saga|série)\s+/i, '').trim();

async function googleBook(it, key) {
  const title = cleanTitle(it.title), author = firstAuthor(it.creator);
  const tries = [
    `intitle:"${title}"${author ? ` inauthor:"${author}"` : ''}`,
    `${title} ${author}`.trim(),
  ];
  let best = null, bestScore = -Infinity;
  for (const q of tries) {
    for (const lang of ['pt', '']) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books${lang ? '&langRestrict=' + lang : ''}${key ? '&key=' + key : ''}`;
      const j = await getJson(url);
      for (const v of j.items || []) {
        const vi = v.volumeInfo || {};
        let sc = 0;
        const t = norm(vi.title), want = norm(title);
        if (t === want) sc += 10; else if (t.startsWith(want) || want.startsWith(t)) sc += 5; else if (t.includes(want)) sc += 2;
        if (author && (vi.authors || []).some(a => norm(a).includes(norm(author).split(' ').pop()))) sc += 6;
        if (vi.imageLinks?.thumbnail) sc += 3;
        if (vi.language === 'pt' || vi.language === 'pt-BR') sc += 2;
        if (vi.description) sc += 1;
        if (sc > bestScore) { best = vi; bestScore = sc; }
      }
      await sleep(250);
      if (bestScore >= 19) break;
    }
    if (bestScore >= 15) break;
  }
  return bestScore >= 10 ? best : null;
}

async function openLibraryCover(it) {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle(it.title))}${firstAuthor(it.creator) ? '&author=' + encodeURIComponent(firstAuthor(it.creator)) : ''}&limit=5&fields=title,cover_i`;
  const j = await getJson(url, { headers: { 'User-Agent': 'Sessao/1.0 (github.com/adrianobarrosc/Sessao)' } });
  const hit = (j.docs || []).find(d => d.cover_i);
  await sleep(400);
  return hit ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg` : null;
}

export async function enrichBooks(items, previousItems, key) {
  const todo = reuse(items, previousItems);
  let ok = 0;
  for (const it of todo) {
    try {
      let cover = null, summary = null;
      const vi = await googleBook(it, key);
      if (vi) {
        const t = vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail;
        if (t) cover = t.replace('http:', 'https:').replace('&edge=curl', '') + '&fife=w480-h720';
        if (vi.description) summary = { text: stripHtml(vi.description), source: 'Google Books', lang: vi.language || '' };
      }
      if (!cover) cover = await openLibraryCover(it);
      it.visual = { v: VERSION, cover, source: cover ? (cover.includes('openlibrary') ? 'Open Library' : 'Google Books') : null };
      if (!it.synopsis && summary) it.extSummary = summary;
      if (cover) ok++;
    } catch (e) { console.error(`Livros: ${it.title}: ${e.message}`); }
  }
  console.log(`Livros: ${todo.length} consultados agora, ${ok} com capa nova`);
}

// ---------- Jogos ----------
export async function enrichGames(items, previousItems, clientId, clientSecret) {
  const todo = reuse(items, previousItems);
  if (!todo.length) { console.log('Jogos: nada novo para consultar'); return; }
  const tok = await getJson(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
  const headers = { 'Client-ID': clientId, Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' };
  let ok = 0;
  for (const it of todo) {
    try {
      const name = it.title.replace(/\([^)]*\)/g, '').replace(/™|®/g, '').replace(/"/g, '').trim();
      const body = `search "${name}"; fields name,alternative_names.name,cover.image_id,summary,first_release_date,total_rating_count,game_type,version_parent; limit 15;`;
      const res = await fetch('https://api.igdb.com/v4/games', { method: 'POST', headers, body });
      if (res.status === 429) { await sleep(1500); continue; }
      if (!res.ok) throw new Error('IGDB ' + res.status);
      const list = await res.json();
      let best = null, bestScore = -Infinity;
      for (const g of list) {
        const names = [g.name, ...(g.alternative_names || []).map(a => a.name)].map(norm);
        const want = norm(name);
        let sc = names.includes(want) ? 10 : names.some(n => n.startsWith(want) || want.startsWith(n)) ? 4 : 0;
        if (g.cover?.image_id) sc += 3;
        if (g.version_parent) sc -= 2;
        sc += Math.log10((g.total_rating_count || 0) + 1);
        if (sc > bestScore) { best = g; bestScore = sc; }
      }
      if (best && bestScore >= 7) {
        const cover = best.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${best.cover.image_id}.jpg` : null;
        it.visual = { v: VERSION, cover, source: 'IGDB', igdbName: best.name };
        if (!it.synopsis && best.summary) it.extSummary = { text: best.summary, source: 'IGDB', lang: 'en' };
        if (cover) ok++;
      } else it.visual = { v: VERSION, cover: null, source: null };
    } catch (e) { console.error(`Jogos: ${it.title}: ${e.message}`); }
    await sleep(280);
  }
  console.log(`Jogos: ${todo.length} consultados agora, ${ok} com capa nova`);
}
