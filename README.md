# Minhas Platinas

Gerenciador pessoal de platinas de PlayStation, hospedado no GitHub Pages.

- **Lista de desejos**: todos os jogos que você quer platinar.
- **Backlog**: fila de até 10 jogos em banners. Arraste para reordenar (mouse, toque ou teclado) e use a lixeira para devolver o jogo à lista de desejos.
- **Perfil**: nome, e-mail, ID da PSN e backup (exportar/importar um `.json`).
- **Ficha do jogo**: dados consolidados de PowerPyx, MyPST, PSX Trophies Brasil e PSNProfiles. Inclui developer/publisher, resumo, autopop, dificuldade, tempo, troféus offline/online/perdíveis/bugados, se a dificuldade afeta os troféus, número de jogadas, macetes/bugs/glitches/cheats, guias, vídeos, mapas (Map Genie) e a faixa de **implatinável / servidores fechados**.

Seus dados ficam no `localStorage` do navegador. Nada pessoal vai para o repositório.

## Publicar no GitHub Pages

1. Crie um repositório **público** chamado `minhas-platinas` no GitHub e envie este código:
   ```bash
   git add -A && git commit -m "Minhas Platinas"
   git remote add origin git@github.com:SEU_USUARIO/minhas-platinas.git
   git push -u origin main
   ```
   Outro nome de repositório também funciona: o build usa o nome automaticamente.
2. No repositório, abra **Settings → Pages** e, em *Source*, escolha **GitHub Actions**.
3. Rode o workflow **Publicar no GitHub Pages** (aba *Actions*) ou faça um push. O site fica em `https://SEU_USUARIO.github.io/minhas-platinas/`.

## Ativar o "Buscar dados"

O navegador não consegue ler os sites de troféus direto (CORS), então a coleta roda no GitHub Actions:

```
App → API do GitHub (workflow_dispatch) → scrape.yml coleta os sites
    → commit em public/data/games/<jogo>.json → publica o Pages → o app detecta e atualiza
```

1. Crie um token em **GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token**:
   - *Repository access*: **Only select repositories** → `minhas-platinas`
   - *Repository permissions*: **Actions → Read and write**
2. No app, abra **Perfil → GitHub**, confira usuário e repositório (já vêm preenchidos no github.io), cole o token e salve.
3. Na lista de desejos, clique no botão de atualizar do jogo (ou marque "Buscar dados ao adicionar"). Leva de 1 a 3 minutos.

> O token fica só no seu navegador. Qualquer outro site seu em `SEU_USUARIO.github.io` compartilha o mesmo `localStorage`, por isso restrinja o token a este repositório. O backup não inclui o token, a menos que você marque a opção.

Se um site achar o jogo errado, abra a ficha → **Links das fontes**, cole a URL certa e clique em **Atualizar dados**.

## De onde vem cada informação

| Campo | Fonte (ordem de preferência) |
|---|---|
| Developer / Publisher | PSX Trophies |
| Resumo | MyPST (PT-BR) → PowerPyx (EN) |
| Autopop, tempo, troféus offline/online/perdíveis/bugados, dificuldade afeta, nº de jogadas | PowerPyx → MyPST |
| Dificuldade estimada | média de PowerPyx e MyPST (0–10), com cada leitura visível |
| Dificuldade da comunidade | PSX Trophies (escala do site) |
| Implatinável / servidores fechados | qualquer fonte que mencione servidores desligados ou platina impossível |
| Macetes, bugs, glitches, cheats | frases do roadmap do PowerPyx e do guia do MyPST, por palavra-chave |
| Guias | PowerPyx, MyPST (fórum), PSX Trophies, links de busca do PSNProfiles, PlayStationTrophies, TrueTrophies e Reddit |
| Vídeos | vídeos embutidos nos guias (canal e título via oEmbed) + busca nos canais de `src/config/channels.ts` |
| Mapas | Map Genie, quando existe página do jogo |
| Capa | wallpaper do PowerPyx → ícone da PSN (PSX Trophies) |

Campos que nenhuma fonte trouxe aparecem como "—".

## Limitações conhecidas

- **PSNProfiles bloqueia coleta automática** (Cloudflare devolve 403, inclusive para Chromium headless). A ficha traz links de busca de jogo e guia para abrir manualmente.
- **Nem todo jogo tem guia no MyPST** (fórum). Quando não tem, os campos vêm do PowerPyx.
- **Autopop, resumo e dicas são heurísticos** (texto livre). Confira sempre o guia original, que está linkado em cada campo.
- **Os JSONs dos jogos ficam públicos** no repositório (Pages gratuito exige repositório público). Perfil, e-mail e token nunca são enviados.
- **Uso pessoal**: o crawler faz no máximo 1 requisição por segundo por site e coleta um jogo por vez.

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:5173/minhas-platinas/
npm test             # testes do store, backup e parsers (offline, com fixtures)
npm run build
npm run scrape -- --name "Ghost of Tsushima" --platform PS5
npm run scrape -- --name "Returnal" --urls '{"mypst":"https://forum.mypst.com.br/index.php?/topic/76518-returnal-guia-de-trof%C3%A9us/"}'
```

O `scrape` grava em `public/data/games/<slug>.json`, e o `npm run dev` já mostra a ficha.

Estrutura:

```
src/            app React (páginas, store zustand, integração com GitHub)
scraper/        crawler Node (sources/ por site, merge.ts, cli.ts, fixtures/ para testes)
.github/        deploy.yml (Pages) e scrape.yml (coleta disparada pelo app)
```
