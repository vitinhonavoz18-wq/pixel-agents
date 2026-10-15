# AUDITORIA — Pixel Agents → PIXEL AGENCY

Data: 2026-10-14 · Base: `pixel-agents` v1.4.1 (fork `vitinhonavoz18-wq/pixel-agents`, branch `claude/clever-noether-46zvxb`)
Licença do projeto base: **MIT** (© Pablo De Lucca e contribuidores — ver `LICENSE`). Toda obra derivada mantém o aviso de licença e a atribuição; os sprites e a fonte FS Pixel Sans continuam sob as licenças já documentadas no `README.md` original.

Este documento registra o que foi estudado no repositório, o que é **reaproveitado sem alteração**, o que é **adaptado** e o que é **implementado do zero** para o PIXEL AGENCY (Android, tablet e Web, cloud‑first).

---

## 1. Arquitetura encontrada

| Camada    | Pasta                                         | Papel                                                                                                                                                                                         | Depende de         |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Contrato  | `core/`                                       | Protocolo AsyncAPI 3.0 (`asyncapi.yaml` → `messages.ts` gerado), interfaces `HookProvider`, `TeamProvider`, `MessageTransport`, utilitários de assets (decodificação PNG → `SpriteData`)      | nada               |
| Runtime   | `server/`                                     | `AgentRuntime`, `AgentStateStore` (EventEmitter), `SessionRouter`, `HookEventHandler`, Fastify (HTTP + `/ws`), provider Claude (hooks + transcript JSONL), persistência em `~/.pixel-agents/` | `core/`            |
| UI        | `webview-ui/`                                 | React 19 + Canvas 2D: motor do escritório (`office/engine`), editor de layout, sprites, Áreas, overlays                                                                                       | `core/`            |
| Adaptador | `adapters/vscode/`                            | Extensão VS Code (terminais, webview, migração)                                                                                                                                               | `core/`, `server/` |
| Testes    | `server/__tests__`, `webview-ui/test`, `e2e/` | Vitest + Playwright (VS Code real e standalone)                                                                                                                                               | —                  |

Fluxo: _hooks/JSONL → `HookProvider.normalizeHookEvent` → `AgentEvent` → `AgentRuntime` → `AgentStateStore` → `ServerMessage` → transporte (postMessage ou WebSocket) → `useExtensionMessages` → `OfficeState` (imperativo) → renderer Canvas._

### Pontos-chave identificados

1. **O renderer é desacoplado do host por um único ponto**: `webview-ui/src/transport/index.ts::createTransport()`. Qualquer host que fale o protocolo `ServerMessage`/`ClientMessage` dirige o escritório inteiro (personagens, animações de digitar/ler, balões de permissão/espera, sub‑agentes, efeito Matrix, Áreas).
2. **Assets são dados**, não código: os PNGs (516 KB) decodificam para ~850 KB de JSON (`core/src/assets/loader.ts`). Cabem num HTML único embutível em WebView Android sem servidor.
3. **Áreas** (`OfficeLayout.areas`/`areaTiles` + `areaMappings`) já fazem o personagem preferir assentos de uma região nomeada — é exatamente o mecanismo necessário para **departamentos**.
4. **Nome do personagem**: `agentTeamInfo.agentName` já é exibido no overlay — serve para mostrar "Franklin", "Allyson".
5. **Dependências específicas do VS Code**: só em `adapters/vscode/` e no `PostMessageTransport` (`acquireVsCodeApi`). O motor não depende do VS Code.
6. **Sem suporte a toque**: `OfficeCanvas.tsx` só trata mouse/roda (pan com botão do meio, zoom com Ctrl+roda). Precisa de gestos (arrastar, pinça) para tablet/celular.
7. **Integração Claude existente é observacional**: o Pixel Agents _observa_ sessões do Claude Code locais (hooks/JSONL); ele não _executa_ agentes. `formatToolStatus` e `normalizeHookEvent` do provider Claude são reutilizáveis para traduzir eventos de execução em status legível.
8. **Visão**: o escritório original é top‑down 3/4 (não isométrico verdadeiro). Reescrever para isometria seria reescrever renderer, z‑sort, editor e todos os sprites; ver §5.

---

## 2. Reaproveitado sem alteração

| Item                                                                                                                | Onde                                                           | Uso no PIXEL AGENCY                                       |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| Motor do escritório (OfficeState, characters FSM, pathfinding BFS, renderer, sprites, matrix effect, pets, carpets) | `webview-ui/src/office/**`                                     | Escritório da agência (embutido via WebView/iframe)       |
| Editor de layout (piso, paredes, móveis, Áreas, undo/redo)                                                          | `webview-ui/src/office/editor/**`, `hooks/useEditorActions.ts` | "Organizar escritório" no tablet                          |
| Protocolo `ServerMessage`/`ClientMessage`                                                                           | `core/src/messages.ts`                                         | Linguagem entre app e escritório                          |
| Decodificação de assets                                                                                             | `core/src/assets/**`                                           | Gerar o bundle de assets embutido                         |
| Formatação de status de ferramentas                                                                                 | `server/src/providers/hook/claude/claude.ts::formatToolStatus` | Texto "Reading x.ts", "Running: npm test" no backend      |
| Todo o produto original (extensão VS Code + `npx pixel-agents`)                                                     | —                                                              | Continua funcionando; testes originais continuam passando |

## 3. Adaptado (mudanças mínimas e retrocompatíveis no código original)

| Mudança                                                              | Arquivo                                           | Motivo                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Terceiro transporte `HostBridgeTransport` + detecção `isAgencyEmbed` | `webview-ui/src/transport/`, `runtime.ts`         | Escritório dirigido pelo app (React Native WebView ou iframe), sem servidor local |
| Modo embed esconde toolbar/intro/consentimento de hooks do VS Code   | `App.tsx`                                         | Esses fluxos são do produto desktop; no app quem governa é o host                 |
| Gestos de toque: arrastar = pan, pinça = zoom, toque = selecionar    | `office/components/OfficeCanvas.tsx`              | Tablet/smartphone (beneficia também o standalone no navegador do celular)         |
| Build "office single-file" com assets decodificados embutidos        | `webview-ui/vite.agency.config.ts`, `src/agency/` | HTML autocontido para o APK (offline) e para a Web                                |
| Layout da agência com 6 departamentos (Áreas)                        | `agency/office-layout/` (gerador)                 | Desenvolvimento, Automações, Marketing, Design, Qualidade, Infraestrutura         |

## 4. Implementado do zero (`agency/`)

| Módulo                   | Pasta                   | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contratos compartilhados | `agency/shared`         | Esquemas Zod (agentes, departamentos, projetos, missões, eventos, chat, aprovações, uso, branding, previews), máquina de estados de atividade, tradução _agência → protocolo do escritório_                                                                                                                                                                                                                                                                                                                                                   |
| Backend cloud            | `agency/backend`        | Fastify + WebSocket, autenticação por token com escopos e revogação, rate limiting, auditoria, persistência em disco (atomic write), fila de missões com concorrência e recuperação, workspaces git isolados por missão, política contra comandos destrutivos, aprovações, executor **Claude Agent SDK** (oficial), `ClaudeUsageProvider`, `UsageAlertsService`, `ProjectBrandingEngine`/`BrandAssetExtractor`, `ProjectPreviewEngine`/`ProjectAssetCache`, integração GitHub (lista de repositórios autorizados), ingestão do Desktop Bridge |
| App                      | `agency/app`            | Expo + React Native + Expo Router + Reanimated + Gesture Handler; escritório embutido; HUD "Uso Claude"; Agentes, Chat com streaming, Missões/Kanban, Projetos com identidade visual, Previews (`ProjectMediaViewer`), Config; modo DEMO explícito; build Web e EAS (APK)                                                                                                                                                                                                                                                                     |
| Desktop Bridge           | `agency/desktop-bridge` | CLI Node que lê `~/.pixel-agents/server.json`, assina o `/ws` local do Pixel Agents e encaminha eventos ao backend; script de statusline que reporta `rate_limits` oficiais da assinatura                                                                                                                                                                                                                                                                                                                                                     |

## 5. Decisões e limitações verificadas

- **Integração Claude suportada**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, `query()`), autenticado por **`ANTHROPIC_API_KEY`** (ou Bedrock/Vertex/Foundry). Política oficial: _"Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."_ → o app **não** usa login claude.ai, cookies ou sessões de claude.ai/code. A sessão atual do Claude Code Web é só o ambiente de desenvolvimento.
- **Claude Managed Agents** existe (beta `managed-agents-2026-04-01`, sandbox hospedado pela Anthropic). A interface `AgentExecutor` do backend permite um executor Managed Agents; a primeira versão implementa o Agent SDK (sandbox próprio em contêiner).
- **Limites da assinatura (sessão 5 h / semanal)**: a única fonte documentada é o campo `rate_limits.five_hour|seven_day.{used_percentage,resets_at}` do JSON da _statusline_ do Claude Code (apenas Pro/Max, após a primeira resposta). Logo: disponível **somente via Desktop Bridge**; no modo cloud o painel exibe "Dados de limite indisponíveis nesta integração."
- **Consumo dos agentes**: `result.usage`/`modelUsage`/`total_cost_usd` do Agent SDK — o custo é **estimativa local do SDK**, rotulada como tal.
- **Créditos financeiros**: não existe endpoint oficial de saldo de créditos pré‑pagos. Custos reais da organização só pela Admin API (`/v1/organizations/cost_report`, chave `sk-ant-admin…`) — integração opcional, desligada sem chave.
- **Isometria**: mantida a projeção 3/4 do motor original (top‑down com profundidade por Y). Converter para isométrico verdadeiro exigiria novos sprites e reescrita do renderer e editor; registrado como evolução futura.
- **Imagens de referência**: foram anexadas a logomarca PIXEL AGENCY (Imagem A) e a tela conceitual (Imagem B). **A logomarca FlyDelivery (Imagem C) e o print de uso do Claude (Imagem D) não vieram nos anexos**; portanto nenhuma logo FlyDelivery foi criada — ela será extraída do repositório do projeto pelo `ProjectBrandingEngine` ou enviada pelo usuário.

## 6. Testes e build originais

`npm run check-types`, `npm run lint`, `npm run test:server`, `npm run test:webview` continuam válidos; as mudanças em `webview-ui` são cobertas pelos testes existentes e por novos testes do modo embed.
