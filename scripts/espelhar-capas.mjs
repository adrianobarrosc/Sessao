// Copia para o próprio site (pasta capas/jogos/) as capas de jogos hospedadas em outros servidores.
// Motivo: o servidor de imagens da RAWG (media.rawg.io) não abre em algumas redes, e as capas sumiam.
// Cada imagem é baixada uma única vez (o nome do arquivo vem do endereço original) e fica no repositório.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PASTA = new URL('../capas/jogos/', import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function espelharCapasJogos(items) {
  if (!existsSync(PASTA)) mkdirSync(PASTA, { recursive: true });
  let novas = 0, prontas = 0, falhas = 0;
  for (const it of items || []) {
    const v = it.visual;
    if (!v) continue;
    const remota = v.coverRemote || v.cover;
    if (!remota || !/^https?:\/\//.test(remota) || remota.includes('adrianobarrosc.github.io')) continue;
    const ext = (remota.split('?')[0].match(/\.(jpe?g|png|webp)$/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const nome = createHash('sha1').update(remota).digest('hex').slice(0, 16) + '.' + ext;
    const arq = new URL(nome, PASTA);
    if (!existsSync(arq)) {
      try {
        const res = await fetch(remota, { headers: { 'User-Agent': 'Sessao/1.0 (github.com/adrianobarrosc/Sessao)' } });
        if (!res.ok) throw new Error(res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 500) throw new Error('arquivo vazio');
        writeFileSync(arq, buf);
        novas++;
        await sleep(120);
      } catch (e) { falhas++; console.error(`Capa de jogo não baixada (${it.title}): ${e.message}`); continue; }
    } else prontas++;
    it.visual = { ...v, coverRemote: remota, cover: 'capas/jogos/' + nome };
  }
  console.log(`Capas de jogos no próprio site: ${novas} baixadas agora, ${prontas} já guardadas, ${falhas} falhas`);
}
