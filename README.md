# Sessão · O que consumir hoje?

Consulta rápida do meu catálogo pessoal de **filmes, séries, leituras e jogos**, que fica no Notion.
Escolha a mídia e o gênero e veja as opções, com ficha completa e títulos relacionados.

**Site:** https://adrianobarrosc.github.io/Sessao/

## Instalar como app (Android, tablet, computador)

O site é um app instalável (PWA): abra o endereço no Chrome ou no Samsung Internet e toque em **⬇ Instalar app** (no topo da página) ou, no menu do navegador, em **Instalar app / Adicionar à tela inicial**. O app abre em tela cheia, funciona sem internet com a última cópia dos dados e se atualiza sozinho.

## Como os dados chegam aqui

- O arquivo `data.json` é uma cópia das páginas **Filmes**, **Streaming**, **Leitura** e **Games** do Notion.
- Todo dia às 06h17 (horário de Brasília), a automação em `.github/workflows/atualizar.yml` lê essas páginas pela API do Notion, gera um novo `data.json` e republica o site.
- Também dá para atualizar na hora: aba **Actions** → **Atualizar dados do Notion e publicar** → **Run workflow**.

## Onde assistir (TMDB)

Na ficha de cada filme e série aparece **onde assistir no Brasil** (assinatura, grátis, aluguel e compra), com o pôster e a nota do TMDB.
Os dados vêm da JustWatch, via API do TMDB, e são buscados pela mesma automação diária. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.

## Capas e resumos de livros e jogos

- **Livros:** capa e resumo pelo Google Books (com a Open Library como reserva de capa). O resumo só aparece quando o Notion não tem sinopse.
- **Jogos:** imagem, resumo, nota, Metacritic e data de lançamento pela RAWG (secret `RAWG_KEY`; plano gratuito, uso não comercial, com link para a RAWG em cada ficha). Os resumos da RAWG vêm em inglês e aparecem no site traduzidos para o português (veja abaixo). O IGDB continua disponível como alternativa (secrets `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`).
- Títulos já encontrados são reaproveitados; só os novos são consultados a cada dia.

## Séries em "Temporada Adiantada"

A ficha dessas séries mostra dois resumos: **Sinopse da série** (geral, do TMDB, para quem vai começar) e **Temporada onde eu estou** (a sinopse da temporada escrita no Notion, com o campo *Temporada atual (informada)*). Quando o TMDB só tem a sinopse em inglês, ela entra na mesma fila de tradução dos jogos.

## Tradução dos resumos de jogos e sinopses de séries

- As traduções ficam em `traducoes/jogos.json` e `traducoes/series.json` (uma por jogo, com um código do texto original). A automação diária aplica a tradução sempre que o resumo da RAWG não mudou.
- Jogo novo, ou resumo que mudou, aparece em inglês até ser traduzido. Uma tarefa agendada do Claude roda todo dia depois da atualização: lista os pendentes com `node scripts/traducao-pendentes.mjs pendentes.json`, traduz e grava com `node scripts/traducao-salvar.mjs traduzidos.json` (formato `[{"tipo","titulo","hash","pt"}]`, com `tipo` = `jogo` ou `serie`).
- Para corrigir uma tradução, edite o texto `pt` em `traducoes/jogos.json`.

## Conversa com o Claude

A conversa só funciona na versão aberta no claude.ai. Neste site, o botão **Conversar com o Claude** abre essa versão.

## Configuração (uma vez só)

1. **Criar a integração no Notion:** em https://www.notion.so/profile/integrations → **Nova integração** (tipo *Interna*, só leitura de conteúdo). Copie o *Internal Integration Secret*.
2. **Dar acesso às páginas:** em cada página (Filmes, Streaming, Leitura, Games), menu **⋯** → **Conexões** → adicione a integração criada.
3. **Guardar a chave no GitHub:** neste repositório, **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, nome `NOTION_TOKEN`, valor = a chave copiada.
4. **Guardar o token do TMDB:** mesmo caminho do passo 3, nome `TMDB_TOKEN`, valor = o *Token de Leitura da API* (o mais longo, que começa com `eyJ`).
5. **Guardar a chave do Google Books:** secret `GOOGLE_BOOKS_KEY` (chave de API do Google Cloud com a *Books API* ativada).
6. **Guardar as credenciais do IGDB:** secrets `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` (aplicativo criado em dev.twitch.tv/console).
7. **Ativar o GitHub Pages:** **Settings** → **Pages** → *Source*: **GitHub Actions**.
8. Rode a automação uma vez (passo de atualização acima).

## Observações

- O repositório e o site são **públicos**: qualquer pessoa com o link vê o catálogo.
- A conversa com o Claude só funciona na versão aberta no claude.ai; aqui ela fica oculta.
- Arquivos: `index.html` (a página), `scripts/build-data.mjs` (leitura do Notion), `scripts/parser.cjs` (interpretação das tabelas).
