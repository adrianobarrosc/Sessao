// Grava traduções em traducoes/jogos.json. Uso: node scripts/traducao-salvar.mjs traducoes.json
// O arquivo é uma lista de { titulo, hash, pt }, com titulo e hash copiados da lista de pendentes.
import { readFileSync } from 'node:fs';
import { salvar } from './traducoes.mjs';
const novas = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(`${novas.length} traduções gravadas; ${salvar(novas)} no total`);
