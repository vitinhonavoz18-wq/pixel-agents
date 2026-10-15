# PIXEL AGENCY

Agência virtual de IA em pixel art — Android, tablet e Web — construída sobre o [Pixel Agents](../README.md) (MIT).
Você administra um escritório com departamentos, agentes Claude que trabalham em **missões reais** nos seus repositórios GitHub, chat dentro do jogo, aprovações, relatórios e o painel **Uso Claude**.

> Cloud-first: tudo funciona sem o seu computador. O computador é opcional (Desktop Bridge).

```
┌────────────── App PIXEL AGENCY (Expo: Android / Web) ──────────────┐
│ Escritório pixel (Pixel Agents embutido) · HUD · Chat · Kanban     │
│ Projetos (identidade visual) · Uso Claude · Aprovações · Agentes   │
└──────────────┬──────────────────────────────────────▲─────────────┘
       REST (Bearer)                         WebSocket (eventos ao vivo)
┌──────────────▼──────────────────────────────────────┴─────────────┐
│ Backend PIXEL AGENCY (Node + Fastify)                               │
│ Auth/escopos · auditoria · rate limit · fila de missões             │
│ Política de segurança · aprovações · estados derivados de eventos   │
│ ClaudeUsageProvider · ProjectBrandingEngine · ProjectPreviewEngine  │
│        │ Claude Agent SDK (query)          │ git (clone isolado)    │
│        ▼                                    ▼                        │
│  Claude (ANTHROPIC_API_KEY)        workspaces/<projeto>/<missão>     │
└──────────────────────────────────▲───────────────────────────────────┘
                                   │ (opcional) Desktop Bridge
                       Pixel Agents local + statusline do Claude Code
```

## Estrutura

| Pasta                                                               | O quê                                                                                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared/`                                                           | Contratos Zod compartilhados, estados de atividade, `OfficeSync` (estado da agência → protocolo do escritório), modelos de agentes, importação de agentes do Claude Code |
| `backend/`                                                          | API + WebSocket, fila de missões, executor Claude Agent SDK, política de segurança, uso, branding, previews, Desktop Bridge hub                                          |
| `app/`                                                              | Aplicativo Expo Router (Android + Web)                                                                                                                                   |
| `desktop-bridge/`                                                   | CLI que liga o Pixel Agents local e a statusline do Claude Code ao backend                                                                                               |
| `office-layout/`                                                    | Gerador do layout com os 6 departamentos                                                                                                                                 |
| `../webview-ui/src/agency/` + `../webview-ui/vite.agency.config.ts` | Entrada do escritório embutido (HTML único, offline)                                                                                                                     |

## Começar

```bash
cd agency
npx npm@11 install          # npm 10 tem um bug de árvore de peers neste monorepo
npm run office:build        # gera app/assets/office/office.html a partir do Pixel Agents
npm test                    # shared + backend + desktop-bridge + app
npm run typecheck
```

### Backend

```bash
cd agency/backend
cp .env.example .env        # preencha AGENCY_ADMIN_TOKEN e ANTHROPIC_API_KEY
npm run dev                 # http://localhost:8787
```

Crie tokens para o app e para o bridge (o token de admin vem do `.env`):

```bash
curl -X POST $URL/api/tokens -H "Authorization: Bearer $AGENCY_ADMIN_TOKEN" \
  -H 'content-type: application/json' -d '{"name":"tablet","scopes":["app"],"projects":"*"}'
```

Deploy em nuvem: [docs/DEPLOY-BACKEND.md](docs/DEPLOY-BACKEND.md).

### App

```bash
cd agency/app
npm run web                 # navegador
npm run build:web           # export estático em app/dist
```

No app: **Config → URL do backend + token → Salvar e conectar**. Sem backend, use **MODO DEMO** (simulação local, sempre rotulada).

APK Android pela nuvem (EAS): [docs/BUILD-ANDROID.md](docs/BUILD-ANDROID.md).

## Regras do produto (garantidas no código)

- **Estados reais**: a animação de trabalho de um personagem só muda por eventos do executor (ferramenta iniciada/terminada, aprovação, fim). Passeio ocioso é decorativo e nunca indica trabalho.
- **Sem dados inventados**: limites da assinatura só aparecem com fonte oficial (statusline do Claude Code via Desktop Bridge); caso contrário: “Dados de limite indisponíveis nesta integração.” Custos são rotulados como _estimativa do Claude Agent SDK_. Saldo de créditos: sem API oficial → indisponível.
- **Sem logos ou telas inventadas**: logos e cores vêm do repositório do projeto; telas vêm do repositório, de captura autorizada da URL do projeto ou de upload seu.
- **DEMO sempre rotulado**: tudo produzido em modo DEMO carrega `demo: true` e o app mostra a faixa “MODO DEMO”.
- **Segredos só no servidor**: o APK não contém chaves; o token do app fica no Keystore do Android.

Mais: [docs/SEGURANCA.md](docs/SEGURANCA.md) · [docs/STATUS.md](docs/STATUS.md) · [AUDITORIA.md](../AUDITORIA.md)

## Licença

MIT. Baseado no Pixel Agents (© Pablo De Lucca e contribuidores). Sprites, móveis e a fonte FS Pixel Sans vêm do projeto original.
