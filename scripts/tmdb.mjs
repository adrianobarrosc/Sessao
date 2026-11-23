// Enriquece filmes e séries com dados do TMDB: pôster, nota e onde assistir no Brasil (JustWatch via TMDB).
const API = 'https://api.themoviedb.org/3';
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
    for (const it of previous[key]?.items || []) if (it.tmdb?.id) prevIds.set(key + '|' + it.title, it.tmdb);

  const candidates = (it) => {
    const out = [];
    const paren = [...it.title.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim());
    const base = it.title.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    let year = /^\d{4}$/.test(it.year || '') ? it.year : '';
    for (const p of paren) if (/^\d{4}$/.test(p)) year = year || p;
    if (it.original) out.push(it.original.replace(/\([^)]*\)/g, '').trim());
    for (const p of paren) if (!/^\d{4}$/.test(p) && !/^\d+/.test(p)) out.push(p.replace(/,?\s*\d{4}$/, '').trim());
    out.push(base);
    return { names: [...new Set(out.filter(Boolean))], year };
  };

  const find = async (it, kind) => {
    const { names, year } = candidates(it);
    for (const query of names) {
      const params = { query, language: 'pt-BR', include_adult: 'false' };
      if (year) params[kind === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = year;
      let r = await get(`/search/${kind}`, params);
      if (!r.results?.length && year) { delete params.primary_release_year; delete params.first_air_date_year; r = await get(`/search/${kind}`, params); }
      if (r.results?.length) return r.results[0];
    }
    return null;
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
        let id = hit?.id, info = hit;
        if (!id) {
          const r = await find(it, kind);
          if (!r) { miss++; continue; }
          id = r.id;
          info = { id, type: kind, poster: r.poster_path || null, rating: r.vote_average || null, name: r.title || r.name };
        }
        const w = await get(`/${kind}/${id}/watch/providers`);
        const br = w.results?.BR;
        it.tmdb = {
          id, type: kind, poster: info.poster || null, rating: info.rating || null, name: info.name || null,
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
