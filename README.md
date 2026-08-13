# SaaS Venda

Aplicação Web local-first para gestão de vendas de varejo e controle de estoque. Todos os dados
ficam no IndexedDB do navegador (via Dexie.js) e são sincronizados com a pasta privada
`appDataFolder` do Google Drive do próprio usuário — sem backend de banco de dados centralizado.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind CSS)
- Dexie.js (IndexedDB) — dados do PDV local-first
- Zustand (estado global: carrinho, sessão, sincronização)
- Google Identity Services (OAuth 2.0) + Drive API v3 (`drive.appdata` scope apenas)
- Supabase (Postgres) — banco de dados da loja online (produtos públicos, pedidos, clientes)
- Mercado Pago (Checkout Pro) — pagamento via PIX/cartão
- Resend — envio de e-mails transacionais (confirmação de pedido e status)
- Lucide React (ícones)

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um OAuth Client ID (tipo "Web application") no
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Ative a **Google Drive API** no projeto.
   - Em "Authorized JavaScript origins", adicione `http://localhost:3000` (e a URL de produção).
   - Não é necessário configurar "Authorized redirect URIs" (fluxo de token implícito via GIS).

3. Copie `.env.local.example` para `.env.local` e preencha:

   ```bash
   cp .env.local.example .env.local
   ```

   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
   ```

4. Rode o projeto:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Como funciona

- **Primeiro acesso**: o primeiro usuário a fazer login com o Google se torna automaticamente
  `ADMIN`. Administradores cadastram atendentes (`ATTENDANT`) em **Usuários** — o e-mail
  cadastrado deve ser o mesmo da conta Google que o atendente usará para logar.
- **Sincronização**: a cada venda ou alteração de estoque/usuários, o app grava localmente no
  IndexedDB (instantâneo) e enfileira um envio do snapshot completo (`saas_store_db.json`) para
  o `appDataFolder` do Drive do usuário logado. O indicador no topo mostra
  `Sincronizado` / `Sincronizando...` / `Erro de Conexão (Modo Offline)`.
- **Escopo mínimo**: a aplicação usa estritamente o escopo
  `https://www.googleapis.com/auth/drive.appdata`, que dá acesso apenas a uma pasta oculta e
  privada da própria aplicação — nunca aos arquivos pessoais do usuário no Drive.
- **Backup manual**: em **Dashboard**, o botão "Exportar Backup (.json)" baixa uma cópia local
  completa dos dados a qualquer momento.

## Perfis de acesso (RBAC)

- **ADMIN**: acesso total — Dashboard, Pedidos Online, Estoque, PDV, Usuários.
- **ATTENDANT**: acesso exclusivo à tela de Venda Direta (`/pos`).

## Loja online (link de venda, pagamento e notificações por e-mail)

Além do PDV local-first, o projeto inclui uma loja pública para vender por link (WhatsApp,
Instagram, etc.), com pagamento via Mercado Pago e notificações automáticas por **e-mail**
(sem custo de API de WhatsApp) em cada etapa do pedido.

### Como funciona

1. Cliente abre `/loja/[slug-da-sua-loja]`, monta o carrinho, informa nome/telefone/e-mail e
   escolhe retirada na loja ou entrega (com endereço).
2. É redirecionado para o checkout do Mercado Pago (PIX ou cartão).
3. Ao aprovar o pagamento, o Mercado Pago chama o webhook (`/api/webhooks/mercadopago`), que:
   dá baixa no estoque, registra o pedido, e envia por e-mail a confirmação para o cliente
   **e** um aviso de novo pedido para o lojista.
4. O lojista acompanha e avança o pedido em `/dashboard/orders` — cada mudança de status
   (Em produção → Enviado/Pronto para retirada → Concluído) dispara automaticamente um novo
   e-mail para o cliente.

### Configuração

1. Crie um projeto gratuito em [supabase.com](https://supabase.com), abra o **SQL Editor** e
   rode o conteúdo de `supabase/schema.sql`.
2. Insira sua loja na tabela `stores` (via Table Editor do Supabase), por exemplo:
   ```sql
   insert into stores (name, slug, owner_email, notification_email)
   values ('Minha Loja', 'minha-loja', 'voce@gmail.com', 'voce@gmail.com');
   ```
3. Os produtos NÃO precisam ser cadastrados manualmente no Supabase: o catálogo agora é
   unificado — ao criar/editar um produto em **Estoque** (`/dashboard/inventory`), marque a
   opção "Exibir este produto na loja online" e ele é replicado automaticamente para o
   Supabase (mesmo id do produto local, então editar ou excluir no PDV atualiza a loja online
   também). Isso só funciona com `NEXT_PUBLIC_STORE_SLUG` e as chaves do Supabase já
   configuradas no `.env.local` — sem isso, o PDV local continua funcionando normalmente, só a
   réplica para a loja online é ignorada.
4. Crie uma conta em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers/panel/app)
   e gere um Access Token.
5. Crie uma conta gratuita em [resend.com](https://resend.com) e gere uma API key (para testes,
   não precisa de domínio próprio verificado).
6. Preencha `.env.local` com as chaves do Supabase, Mercado Pago, Resend e o `NEXT_PUBLIC_STORE_SLUG`
   (veja `.env.local.example`).

> **Nota de segurança**: a `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta no navegador — ela
> só é usada dentro das rotas de API (`src/app/api/**`), que rodam no servidor. O navegador do
> cliente usa apenas a `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que só tem permissão de leitura do
> catálogo público (ver Row Level Security em `supabase/schema.sql`).

## Estrutura

```
src/
  app/
    login/             # Tela de login (Google OAuth) — painel do lojista
    pos/                # PDV — venda direta
    dashboard/          # Dashboard, /orders, /inventory, /users
    loja/[slug]/        # Vitrine pública (loja online)
    loja/pedido/[id]/    # Tela de retorno do pagamento
    api/orders/          # Criar pedido + listar pedidos (lojista)
    api/orders/[id]/status/  # Avançar status do pedido (dispara e-mail)
    api/products/           # Upsert de produto na loja online (chamado pelo Estoque)
    api/products/[id]/       # Remover produto da loja online (chamado pelo Estoque)
    api/webhooks/mercadopago/ # Confirmação de pagamento
  components/           # AppShell, AuthGuard, SyncIndicator
  lib/
    db.ts              # Schema Dexie + import/export JSON (PDV local)
    types.ts            # Tipos User, Product, Sale (PDV local)
    store-types.ts        # Tipos da loja online (Order, Customer, etc.)
    google-auth.ts        # OAuth via Google Identity Services (painel)
    drive-sync.ts          # Leitura/escrita no appDataFolder (PDV local)
    use-sync.ts             # Orquestração de sincronização (PDV local)
    online-store-sync.ts     # Replica produtos do PDV local -> loja online (Supabase)
    store.ts                # Zustand: carrinho, sessão, status de sync
    supabase-server.ts        # Cliente Supabase (service role — só backend)
    supabase-public.ts         # Cliente Supabase (anon key — só leitura, browser)
    mercadopago.ts               # Criação de preferência de pagamento
    email.ts                      # Templates e envio de e-mail (Resend)
supabase/
  schema.sql             # Schema do banco (rodar no SQL Editor do Supabase)
```

## Build de produção

```bash
npm run build
npm start
```
