// Enriquece filmes e séries com dados do TMDB: pôster, nota e onde assistir no Brasil (JustWatch via TMDB).
import { readFileSync } from 'node:fs';
const API = 'https://api.themoviedb.org/3';
let AJUSTES = {};
try { AJUSTES = JSON.parse(readFileSync(new URL('./tmdb-ajustes.json', import.meta.url), 'utf8')); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function enrichWithTmdb(sources, token, previous = {}) {
  const get = async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    for (let tent = 0; tent < 4; tent++) {
      const res = await fetch(`${API}${path}${qs ? '?' + qs : ''}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (tent + 1)); continue; }
      if (!res.ok) throw new Error(`TMDB ${res.status} em ${path}`);
      return res.json();
    }
    throw new Error(`TMDB indisponível em ${path}`);
  };

  // reaproveita o id já encontrado antes (evita trocar de título a cada dia)
  const prevIds = new Map();
  for (const key of ['filmes', 'streaming'])
    for (const it of previous[key]?.items || []) if (it.tmdb?.id && it.tmdb.v === 2) prevIds.set(key + '|' + it.title, it.tmdb);

  const candidates = (it) => {
    const out = [];
    const paren = [...it.title.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim());
    const base = it.title.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    let year = /^\d{4}$/.test(it.year || '') ? it.year : '';
    for (const p of paren) if (/^\d{4}$/.test(p)) year = year || p;
    if (AJUSTES[it.title]?.ano) year = String(AJUSTES[it.title].ano);
    if (it.original) out.push(it.original.replace(/\([^)]*\)/g, '').trim());
    for (const p of paren) if (!/^\d{4}$/.test(p) && !/^\d+/.test(p)) out.push(p.replace(/,?\s*\d{4}$/, '').trim());
    out.push(base);
    return { names: [...new Set(out.filter(Boolean))], year };
  };

  const norm = x => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'e').replace(/[^a-z0-9]+/g, ' ').trim();
  const score = (r, names, year, kind) => {
    const titles = [r.title, r.original_title, r.name, r.original_name].filter(Boolean).map(norm);
    const wanted = names.map(norm).concat(norm(it_title_holder.current));
    let sc = 0;
    if (titles.some(t => wanted.includes(t))) sc += 10;
    else if (titles.some(t => wanted.some(w => w && (t.startsWith(w) || w.startsWith(t))))) sc += 3;
    const d = (r.release_date || r.first_air_date || '').slice(0, 4);
    if (year && d) { const diff = Math.abs(+d - +year); sc += diff === 0 ? 4 : diff === 1 ? 3 : diff <= 2 ? 1 : -2; }
    sc += Math.log10((r.popularity || 0) + 1);
    sc += Math.min(r.vote_count || 0, 2000) / 1000;
    if ((r.vote_count || 0) < 5) sc -= 3;
    if (/making of|behind the|on '|special|bastidores/i.test(r.title || r.name || '')) sc -= 6;
    return sc;
  };
  const it_title_holder = { current: '' };
  const find = async (it, kind) => {
    const { names, year } = candidates(it);
    it_title_holder.current = it.title.replace(/\([^)]*\)/g, '').trim();
    const seen = new Map();
    for (const query of names) {
      const r = await get(`/search/${kind}`, { query, language: 'pt-BR', include_adult: 'false' });
      for (const x of (r.results || []).slice(0, 10)) if (!seen.has(x.id)) seen.set(x.id, x);
    }
    let best = null, bestScore = -Infinity;
    for (const x of seen.values()) { const sc = score(x, names, year, kind); if (sc > bestScore) { best = x; bestScore = sc; } }
    return bestScore >= 3 ? best : null;
  };

  const mapList = (arr) => (arr || []).map(p => ({ name: p.provider_name, logo: p.logo_path }));
  let ok = 0, miss = 0;
  const work = [];
  for (const key of ['filmes', 'streaming']) for (const it of sources[key]?.items || []) work.push([key, it]);
  const queue = work.slice();
  const worker = async () => {
    while (queue.length) {
      const [key, it] = queue.shift();
      const kind = key === 'filmes' ? 'movie' : 'tv';
      try {
        let hit = prevIds.get(key + '|' + it.title);
        if (hit && (AJUSTES[it.title]?.ano || null) !== (hit.ajusteAno || null)) hit = null; // ajuste novo: procura de novo
        let id = hit?.id, info = hit;
        if (!id) {
          const r = await find(it, kind);
          if (!r) { miss++; continue; }
          id = r.id;
          info = { id, type: kind, poster: r.poster_path || null, rating: r.vote_average || null, name: r.title || r.name };
        }
        const w = await get(`/${kind}/${id}/watch/providers`);
        const br = w.results?.BR;
        // Séries: total de temporadas e episódios (todas) e sinopse geral (só em "Temporada Adiantada").
        let sinopse = {}, serie = {};
        if (kind === 'tv') {
          const det = await get(`/tv/${id}`, { language: 'pt-BR' });
          const temporadas = (det.seasons || []).filter(t => t.season_number > 0 && t.episode_count > 0).length || det.number_of_seasons || null;
          serie = { seasons: temporadas, episodes: det.number_of_episodes || null };
          if ((it.path || []).some(p => /temporada adiantada/i.test(p))) {
            if (hit?.overview !== undefined) sinopse = hit.overviewOriginal
              ? { overview: hit.overviewOriginal, overviewLang: 'en' }
              : { overview: hit.overview, overviewLang: hit.overviewLang };
            else {
              const pt = det.overview?.trim();
              if (pt) sinopse = { overview: pt, overviewLang: 'pt' };
              else {
                const en = (await get(`/tv/${id}`, { language: 'en-US' })).overview?.trim();
                sinopse = { overview: en || '', overviewLang: en ? 'en' : null };
              }
            }
          }
        }
        it.tmdb = {
          ...sinopse, ...serie,
          ajusteAno: AJUSTES[it.title]?.ano || null,
          v: 2, id, type: kind, poster: info.poster || null, rating: info.rating || null, name: info.name || null,
          watch: br ? { link: br.link, flatrate: mapList(br.flatrate), free: mapList(br.free), ads: mapList(br.ads), rent: mapList(br.rent), buy: mapList(br.buy) } : { link: `https://www.themoviedb.org/${kind}/${id}/watch?locale=BR`, flatrate: [], free: [], ads: [], rent: [], buy: [] },
        };
        ok++;
      } catch (e) { miss++; console.error(`TMDB: ${it.title}: ${e.message}`); }
      await sleep(60);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`TMDB: ${ok} títulos com dados, ${miss} sem correspondência`);
}
