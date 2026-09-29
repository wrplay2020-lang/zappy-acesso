# Zappy — cadastro de teste

Código da página pública e da rota segura que cria o teste Zappy. A chave da API **não está no repositório**. A interface é servida junto com a API pelo Cloudflare Workers; o GitHub guarda o código e pode acionar a implantação.

## Preparar Cloudflare

1. Crie uma conta gratuita Cloudflare e um banco D1 chamado `zappy-acesso`.
2. Copie o ID do banco para `wrangler.jsonc`, substituindo `COLE_AQUI_O_ID_DO_SEU_D1`.
3. Execute `npx wrangler d1 execute zappy-acesso --remote --file=schema/trial_requests.sql` uma única vez.
4. Configure `ZAPPY_API_KEY` como **secret** do Worker no painel Cloudflare. Nunca coloque seu valor em arquivos do projeto, variáveis públicas, GitHub Actions ou no navegador.
5. Instale dependências com `corepack pnpm install --frozen-lockfile`, rode `corepack pnpm build` e implante com `corepack pnpm deploy` após autenticar o Wrangler na sua conta Cloudflare.
6. Para publicar automaticamente a cada atualização no GitHub, conecte o repositório em **Cloudflare → Workers & Pages → Import a repository**. Escolha o Worker de nome `zappy-acesso`, comando de build `corepack pnpm install --frozen-lockfile && corepack pnpm build` e comando de implantação `npx wrangler deploy --config dist/server/wrangler.json`.

A API exige D1 e a chave secreta; sem ambos, o formulário mostra indisponibilidade. A rota bloqueia requisições vindas de outra origem e limita tentativas por IP. Não publique apenas a pasta `public` pelo GitHub Pages, pois isso não executará `/api/trial`.

O endereço de produção será o subdomínio `workers.dev` atribuído à sua conta ou um domínio próprio. Atualizações no GitHub podem ser conectadas às compilações do Cloudflare Workers depois da primeira implantação.
