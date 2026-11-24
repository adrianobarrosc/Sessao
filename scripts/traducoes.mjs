// Traduções dos resumos de jogos (RAWG, em inglês) feitas pelo Claude.
// traducoes/jogos.json guarda { [título normalizado]: { hash, pt } }. O hash é do trecho em inglês traduzido:
// se a RAWG mudar o texto, a tradução antiga deixa de valer e o jogo volta para a lista de pendentes.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const ARQUIVO = new URL('../traducoes/jogos.json', import.meta.url);
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

export function carregar() {
  return existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : {};
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
    return { titulo: it.title, hash: hash(t), ingles: t };
  }).filter(p => tr[norm(p.titulo)]?.hash !== p.hash);
}

export function salvar(novas) {
  const tr = carregar();
  for (const n of novas) {
    if (!n.titulo || !n.hash || !n.pt) throw new Error('Tradução incompleta: ' + JSON.stringify(n).slice(0, 120));
    tr[norm(n.titulo)] = { titulo: n.titulo, hash: n.hash, pt: n.pt.trim() };
  }
  const ordenado = Object.fromEntries(Object.entries(tr).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(ARQUIVO, JSON.stringify(ordenado, null, 1) + '\n');
  return Object.keys(ordenado).length;
}
