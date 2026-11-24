// Lista os textos ainda em inglês: resumos de jogos (RAWG) e sinopses gerais de séries (TMDB). Uso: node scripts/traducao-pendentes.mjs [arquivo-saida.json]
// Lê o data.json publicado (que guarda o texto original da RAWG em extSummary.original quando já traduzido).
import { readFileSync, writeFileSync } from 'node:fs';
import { pendentes, pendentesSeries } from './traducoes.mjs';
const dados = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const itens = (dados.sources.games?.items || []).map(it =>
  it.extSummary?.original ? { ...it, extSummary: { text: it.extSummary.original, lang: 'en' } } : it);
const lista = [...pendentes(itens), ...pendentesSeries(dados.sources.streaming?.items)];
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(lista, null, 1));
console.log(`${lista.length} textos aguardando tradução`);
