# Sessão · O que consumir hoje?

Consulta rápida do meu catálogo pessoal de **filmes, séries, leituras e jogos**, que fica no Notion.
Escolha a mídia e o gênero e veja as opções, com ficha completa e títulos relacionados.

**Site:** https://adrianobarrosc.github.io/sessao/

## Como os dados chegam aqui

- O arquivo `data.json` é uma cópia das páginas **Filmes**, **Streaming**, **Leitura** e **Games** do Notion.
- Todo dia às 06h17 (horário de Brasília), a automação em `.github/workflows/atualizar.yml` lê essas páginas pela API do Notion, gera um novo `data.json` e republica o site.
- Também dá para atualizar na hora: aba **Actions** → **Atualizar dados do Notion e publicar** → **Run workflow**.

## Configuração (uma vez só)

1. **Criar a integração no Notion:** em https://www.notion.so/profile/integrations → **Nova integração** (tipo *Interna*, só leitura de conteúdo). Copie o *Internal Integration Secret*.
2. **Dar acesso às páginas:** em cada página (Filmes, Streaming, Leitura, Games), menu **⋯** → **Conexões** → adicione a integração criada.
3. **Guardar a chave no GitHub:** neste repositório, **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, nome `NOTION_TOKEN`, valor = a chave copiada.
4. **Ativar o GitHub Pages:** **Settings** → **Pages** → *Source*: **GitHub Actions**.
5. Rode a automação uma vez (passo de atualização acima).

## Observações

- O repositório e o site são **públicos**: qualquer pessoa com o link vê o catálogo.
- A conversa com o Claude só funciona na versão aberta no claude.ai; aqui ela fica oculta.
- Arquivos: `index.html` (a página), `scripts/build-data.mjs` (leitura do Notion), `scripts/parser.cjs` (interpretação das tabelas).
