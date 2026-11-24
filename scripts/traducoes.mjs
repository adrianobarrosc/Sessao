// Traduções feitas pelo Claude: resumos de jogos (RAWG) e sinopses gerais de séries (TMDB) que só existem em inglês.
// traducoes/jogos.json e traducoes/series.json guardam { [título normalizado]: { hash, pt } }. O hash é do trecho em inglês traduzido:
// se a RAWG mudar o texto, a tradução antiga deixa de valer e o jogo volta para a lista de pendentes.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const ARQUIVOS = { jogo: new URL('../traducoes/jogos.json', import.meta.url), serie: new URL('../traducoes/series.json', import.meta.url) };
export const ARQUIVO = ARQUIVOS.jogo;
export const norm = x => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 12);

// Trecho que a ficha mostra: parágrafos inteiros até ~900 caracteres (um parágrafo longo é cortado no fim de uma frase).
export function trecho(texto) {
  const pars = texto.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const out = [];
  let total = 0;
  for (const p of pars) {
    if (total && total + p.length > 900) break;
    if (!total && p.length > 1100) {
      const frases = p.match(/[^.!?]+[.!?]+(\s|$)/g) || [p];
      let s = '';
      for (const f of frases) { if (s && (s + f).length > 900) break; s += f; }
      out.push(s.trim()); total = s.length; break;
    }
    out.push(p); total += p.length;
    if (total >= 600) break;
  }
  return out.join('\n');
}

export function carregar(tipo = 'jogo') {
  const arq = ARQUIVOS[tipo];
  return existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : {};
}

// Sinopse geral das séries (tmdb.overview em inglês) → português, quando a tradução confere com o texto atual.
export function aplicarTraducoesSeries(itens) {
  const tr = carregar('serie');
  let usadas = 0, pend = 0;
  for (const it of itens || []) {
    const t = it.tmdb;
    if (!t || t.overviewLang !== 'en' || !t.overview) continue;
    const reg = tr[norm(it.title)];
    if (reg && reg.hash === hash(trecho(t.overview))) {
      Object.assign(t, { overviewOriginal: t.overview, overview: reg.pt, overviewLang: 'pt', overviewTraduzido: true });
      usadas++;
    } else pend++;
  }
  console.log(`Traduções de séries: ${usadas} sinopses em português, ${pend} aguardando tradução`);
}

// Usado pela automação: troca o resumo em inglês pela tradução, quando ela existe e confere com o texto atual.
export function aplicarTraducoes(itens) {
  const tr = carregar();
  let usadas = 0, pendentes = 0;
  for (const it of itens || []) {
    const s = it.extSummary;
    if (!s || s.lang !== 'en') continue;
    const t = trecho(s.text);
    const reg = tr[norm(it.title)];
    if (reg && reg.hash === hash(t)) {
      it.extSummary = { text: reg.pt, source: s.source, lang: 'pt', traduzido: true, original: s.text };
      usadas++;
    } else pendentes++;
  }
  console.log(`Traduções: ${usadas} resumos em português, ${pendentes} aguardando tradução`);
}

export function pendentes(itens) {
  const tr = carregar();
  return (itens || []).filter(it => it.extSummary?.lang === 'en').map(it => {
    const t = trecho(it.extSummary.text);
    return { tipo: 'jogo', titulo: it.title, hash: hash(t), ingles: t };
  }).filter(p => tr[norm(p.titulo)]?.hash !== p.hash);
}

export function pendentesSeries(itens) {
  const tr = carregar('serie');
  return (itens || []).filter(it => it.tmdb?.overview && (it.tmdb.overviewLang === 'en' || it.tmdb.overviewOriginal)).map(it => {
    const t = trecho(it.tmdb.overviewOriginal || it.tmdb.overview);
    return { tipo: 'serie', titulo: it.title, hash: hash(t), ingles: t };
  }).filter(p => tr[norm(p.titulo)]?.hash !== p.hash);
}

export function salvar(novas) {
  let total = 0;
  for (const tipo of Object.keys(ARQUIVOS)) {
    const doTipo = novas.filter(n => (n.tipo || 'jogo') === tipo);
    if (!doTipo.length) continue;
    const tr = carregar(tipo);
    for (const n of doTipo) {
      if (!n.titulo || !n.hash || !n.pt) throw new Error('Tradução incompleta: ' + JSON.stringify(n).slice(0, 120));
      tr[norm(n.titulo)] = { titulo: n.titulo, hash: n.hash, pt: n.pt.trim() };
    }
    const ordenado = Object.fromEntries(Object.entries(tr).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(ARQUIVOS[tipo], JSON.stringify(ordenado, null, 1) + '\n');
    total += Object.keys(ordenado).length;
  }
  return total;
}
