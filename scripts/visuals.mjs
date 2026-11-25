import { readFileSync } from 'node:fs';
// Capas e resumos de livros (Google Books + Open Library) e jogos (IGDB).
// Só consulta títulos ainda sem dados: o que já foi encontrado é reaproveitado da cópia anterior.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = x => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'e').replace(/[^a-z0-9]+/g, ' ').trim();
const stripHtml = s => (s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+\n/g, '\n').trim();
const VERSION = 1;

async function getJson(url, opts = {}, tries = 4) {
  for (let tent = 0; tent < tries; tent++) {
    const res = await fetch(url, opts);
    if (res.status === 429 || res.status >= 500) { if (tent < tries - 1) await sleep(1500 * (tent + 1)); continue; }
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

let googleDown = false;
async function googleBook(it, key, altTitle) {
  if (googleDown) return null;
  const title = altTitle || cleanTitle(it.title), author = firstAuthor(it.creator).replace(/\s*&.*$/, '');
  const tries = [
    `intitle:"${title}"${author ? ` inauthor:"${author}"` : ''}`,
    `${title} ${author}`.trim(),
  ];
  let best = null, bestScore = -Infinity, bestImg = null, bestImgScore = -Infinity;
  for (const q of tries) {
    for (const lang of ['pt', '']) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books${lang ? '&langRestrict=' + lang : ''}${key ? '&key=' + key : ''}`;
      let j;
      try { j = await getJson(url, {}, key ? 3 : 1); }
      catch (e) { googleDown = true; console.error('Google Books recusou as consultas (' + e.message + '); seguindo só com a Open Library nesta execução.'); return null; }
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
        // uma edição que bate com o título e tem imagem vale mais que uma sem imagem
        if (vi.imageLinks?.thumbnail && sc >= 10 && (!bestImg || sc > bestImgScore)) { bestImg = vi; bestImgScore = sc; }
      }
      await sleep(250);
      if (bestImgScore >= 19) break;
    }
    if (bestImgScore >= 15) break;
  }
  if (bestImg) return bestImg;
  return bestScore >= 10 ? best : null;
}

async function openLibraryCover(it, altTitle) {
  const author = firstAuthor(it.creator).replace(/\s*&.*$/, '');
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(altTitle || cleanTitle(it.title))}${author ? '&author=' + encodeURIComponent(author) : ''}&limit=5&fields=title,cover_i`;
  const j = await getJson(url, { headers: { 'User-Agent': 'Sessao/1.0 (github.com/adrianobarrosc/Sessao)' } }, 2);
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
      // sem resposta do Google, não marca o livro como consultado: tenta de novo na próxima execução
      it.visual = { v: googleDown && !vi ? 0 : VERSION, cover, source: cover ? (cover.includes('openlibrary') ? 'Open Library' : 'Google Books') : null };
      if (!it.synopsis && summary) it.extSummary = summary;
      if (cover) ok++;
    } catch (e) { console.error(`Livros: ${it.title}: ${e.message}`); }
  }
  console.log(`Livros: ${todo.length} consultados agora, ${ok} com capa nova`);
  await retryCovers(items, key);
}

// Nova busca, uma única vez, para livros que ficaram sem capa: edições com imagem e títulos originais.
const RETRY = 2;
async function retryCovers(items, key) {
  let alts = {};
  try { alts = JSON.parse(readFileSync(new URL('./capas-alternativas.json', import.meta.url), 'utf8')); } catch {}
  const sem = items.filter(it => it.visual && !it.visual.cover && (it.visual.retry || 0) < RETRY);
  let ok = 0;
  for (const it of sem) {
    const titulos = [null, ...(alts[it.title] || [])];
    let cover = null, vi = null;
    for (const t of titulos) {
      try {
        const v = await googleBook(it, key, t);
        const th = v?.imageLinks?.thumbnail || v?.imageLinks?.smallThumbnail;
        if (th) { cover = th.replace('http:', 'https:').replace('&edge=curl', '') + '&fife=w480-h720'; vi = v; break; }
      } catch {}
    }
    if (!cover) for (const t of titulos) {
      try { cover = await openLibraryCover(it, t); } catch {}
      if (cover) break;
    }
    if (googleDown && !cover) continue; // Google fora do ar: tenta de novo na próxima execução
    it.visual = { ...it.visual, retry: RETRY, cover, source: cover ? (cover.includes('openlibrary') ? 'Open Library' : 'Google Books') : null };
    if (!it.synopsis && !it.extSummary && vi?.description && /^pt/.test(vi.language || '')) it.extSummary = { text: stripHtml(vi.description), source: 'Google Books', lang: vi.language || '' };
    if (cover) { ok++; console.log(`  capa encontrada: ${it.title}`); } else console.log(`  ainda sem capa: ${it.title}`);
  }
  if (sem.length) console.log(`Livros sem capa: ${sem.length} procurados de novo, ${ok} encontrados`);
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

// ---------- Jogos via RAWG ----------
// Plano gratuito: uso não comercial, até 20 mil requisições/mês e link de volta para a RAWG nas páginas que usam os dados.
export async function enrichGamesRawg(items, previousItems, key) {
  const prev = new Map((previousItems || []).filter(i => i.visual?.v === VERSION && i.visual?.source === 'RAWG').map(i => [norm(i.title), i]));
  const todo = [];
  for (const it of items) {
    const p = prev.get(norm(it.title));
    if (p) { it.visual = p.visual; it.game = p.game; if (p.extSummary && !it.synopsis) it.extSummary = p.extSummary.original ? { text: p.extSummary.original, source: p.extSummary.source, lang: 'en' } : p.extSummary; }
    else todo.push(it);
  }
  let ok = 0, calls = 0;
  for (const it of todo) {
    try {
      const yearM = it.title.match(/\((\d{4})\)/);
      const name = it.title.replace(/\([^)]*\)/g, '').replace(/™|®|©/g, '').replace(/[’']/g, "'").trim();
      const want = norm(name);
      const r = await getJson(`https://api.rawg.io/api/games?key=${key}&search=${encodeURIComponent(name)}&page_size=10`, {}, 3); calls++;
      let best = null, bestScore = -Infinity;
      for (const g of r.results || []) {
        const n = norm(g.name);
        let sc = n === want ? 10 : (n.startsWith(want) || want.startsWith(n)) ? 5 : n.includes(want) ? 2 : 0;
        if (yearM && g.released) sc += g.released.startsWith(yearM[1]) ? 4 : -2;
        if (g.background_image) sc += 2;
        sc += Math.log10((g.ratings_count || g.added || 0) + 1);
        if (sc > bestScore) { best = g; bestScore = sc; }
      }
      if (!best || bestScore < 7) { it.visual = { v: VERSION, cover: null, source: 'RAWG' }; continue; }
      const d = await getJson(`https://api.rawg.io/api/games/${best.id}?key=${key}`, {}, 3); calls++;
      const img = d.background_image || best.background_image;
      it.visual = { v: VERSION, cover: img ? img.replace('/media/', '/media/resize/640/-/') : null, source: 'RAWG', name: d.name };
      it.game = {
        rating: d.rating || null, metacritic: d.metacritic || null, released: d.released || null,
        platforms: (d.platforms || []).map(p => p.platform?.name).filter(Boolean),
        url: `https://rawg.io/games/${d.slug}`,
      };
      if (!it.synopsis && d.description_raw) it.extSummary = { text: d.description_raw.trim(), source: 'RAWG', lang: 'en' };
      if (img) ok++;
    } catch (e) { console.error(`RAWG: ${it.title}: ${e.message}`); }
    await sleep(250);
  }
  console.log(`RAWG: ${todo.length} jogos consultados agora (${calls} requisições), ${ok} com imagem nova`);
}
