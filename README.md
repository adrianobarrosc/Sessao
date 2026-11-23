# Sessão · O que consumir hoje?

Consulta rápida do meu catálogo pessoal de **filmes, séries, leituras e jogos**, que fica no Notion.
Escolha a mídia e o gênero e veja as opções, com ficha completa e títulos relacionados.

**Site:** https://adrianobarrosc.github.io/Sessao/

## Como os dados chegam aqui

- O arquivo `data.json` é uma cópia das páginas **Filmes**, **Streaming**, **Leitura** e **Games** do Notion.
- Todo dia às 06h17 (horário de Brasília), a automação em `.github/workflows/atualizar.yml` lê essas páginas pela API do Notion, gera um novo `data.json` e republica o site.
- Também dá para atualizar na hora: aba **Actions** → **Atualizar dados do Notion e publicar** → **Run workflow**.

## Onde assistir (TMDB)

Na ficha de cada filme e série aparece **onde assistir no Brasil** (assinatura, grátis, aluguel e compra), com o pôster e a nota do TMDB.
Os dados vêm da JustWatch, via API do TMDB, e são buscados pela mesma automação diária. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.

## Capas e resumos de livros e jogos

- **Livros:** capa e resumo pelo Google Books (com a Open Library como reserva de capa). O resumo só aparece quando o Notion não tem sinopse.
- **Jogos:** capa e resumo pelo IGDB (Twitch). Os resumos do IGDB estão em inglês.
- Títulos já encontrados são reaproveitados; só os novos são consultados a cada dia.

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
