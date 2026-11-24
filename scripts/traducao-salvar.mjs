// Grava traduções em traducoes/jogos.json e traducoes/series.json (pelo campo tipo). Uso: node scripts/traducao-salvar.mjs traducoes.json
// O arquivo é uma lista de { tipo, titulo, hash, pt }, com tipo, titulo e hash copiados da lista de pendentes.
import { readFileSync } from 'node:fs';
import { salvar } from './traducoes.mjs';
const novas = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(`${novas.length} traduções gravadas; ${salvar(novas)} no total`);
