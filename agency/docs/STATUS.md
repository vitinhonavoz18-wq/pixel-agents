# Status — PIXEL AGENCY v0.1.0 (2026-10-15)

Legenda: ✅ implementado e testado · 🟢 implementado, validado manualmente/visualmente · 🟡 implementado, depende de credenciais ou infraestrutura sua · 🔶 parcial · ⏳ planejado

## Escritório e experiência de jogo

| Item                                                                                         | Status | Evidência / observação                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Escritório pixel art do Pixel Agents embutido (offline, HTML único 2,7 MB)                   | ✅     | `webview-ui/vite.agency.config.ts`; testes do `HostBridgeTransport`; capturas no Chromium                                               |
| 6 departamentos com piso, cores e decoração próprios (Áreas do motor)                        | ✅     | `office-layout/generateAgencyLayout.ts`; personagens sentam no seu departamento                                                         |
| Personagens com nome, aparência e estação de trabalho                                        | ✅     | `OfficeSync` (testes em `shared/test`)                                                                                                  |
| Animações ligadas a estados reais (lendo, programando, testes, aprovação, concluído, falhou) | ✅     | estados derivados só de eventos do executor (`backend/test/api.test.ts` verifica a sequência)                                           |
| Toque: arrastar (pan), pinça (zoom), tocar (selecionar), editor com o dedo                   | 🟢     | implementado em `OfficeCanvas.tsx`; **ainda não testado em dispositivo físico**                                                         |
| Organizar o escritório (editor de layout) e salvar                                           | 🟢     | layout e assentos salvos no app                                                                                                         |
| Visão isométrica verdadeira                                                                  | ⏳     | mantida a projeção 3/4 do motor original (ver AUDITORIA §5)                                                                             |
| Monitores do escritório exibindo telas reais                                                 | 🔶     | o “monitor” aparece no painel do agente (imagem real do projeto) e abre no `ProjectMediaViewer`; ainda não é desenhado dentro do canvas |
| Interface tablet (painéis acoplados) e celular (painéis recolhíveis)                         | 🟢     | capturas em 1280×800 e 412×915                                                                                                          |

## Funcionalidades

| Item                                                                                                                           | Status | Evidência / observação                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Chat por agente com streaming, histórico, seleção de projeto, ferramentas ao vivo, aprovações inline, cancelar, retomar sessão | ✅     | `api.test.ts` (chat + resume) e fluxo DEMO no navegador                                                           |
| Missões / Kanban (Backlog, Em execução, Aguardando aprovação, Testes, Concluídas, Com erro)                                    | ✅     | `api.test.ts`; fluxo DEMO no navegador                                                                            |
| Detalhe da missão: responsável, projeto, objetivo, status, etapas, alterações (diff), resultado, logs, evidências              | ✅     | `app/app/mission/[id].tsx`                                                                                        |
| Fila com concorrência, um agente por mesa, recuperação após reinício                                                           | ✅     | `missions.ts` (`recover`)                                                                                         |
| Workspaces git isolados por missão (branch `pixel-agency/<id>`)                                                                | ✅     | teste real opcional clonou um repositório GitHub real                                                             |
| Agentes: criar, editar, ativar/desativar, autonomia, importar definição original (`.md` do Claude Code ou JSON)                | ✅     | `shared/test` (import), telas do app                                                                              |
| Allyson e Franklin                                                                                                             | ✅     | **modelos** claramente identificados — não são cópias dos agentes locais; importe os originais para substituí-los |
| Projetos: conectar repositório autorizado, autorizar execução, equipe                                                          | 🟡     | precisa de `AGENCY_GITHUB_TOKEN` no backend                                                                       |
| ProjectBrandingEngine / BrandAssetExtractor (logo, ícones, cores, fontes; cache por commit; escolha do usuário)                | ✅     | testes com fixture + repositório real (selecionou `icon.png`)                                                     |
| ProjectPreviewEngine: screenshots do repositório, upload, captura Playwright (origem travada)                                  | ✅     | teste real capturou uma página; captura exige `AGENCY_ENABLE_CAPTURE=1` + Chromium                                |
| Notificações locais (aprovação, alertas)                                                                                       | 🟢     | `expo-notifications`; não testado em dispositivo                                                                  |
| Logo FlyDelivery                                                                                                               | ⏳     | a imagem não veio nos anexos; será extraída do repositório do FlyDelivery quando conectado (nada foi inventado)   |

## Claude

| Item                                                                                 | Status | Evidência / observação                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Executor oficial Claude Agent SDK (`query`), streaming, sessões, hooks, `canUseTool` | ✅/🟡  | testes com `query` roteirizado; **1 execução real** (“diga oi”) concluída ponta a ponta neste ambiente — ela usou a autenticação injetada pelo proxy desta sessão de nuvem, não uma chave do produto. Em produção requer `ANTHROPIC_API_KEY` |
| Política de segurança + aprovações                                                   | ✅     | `policy.test.ts`, `api.test.ts`                                                                                                                                                                                                              |
| Uso Claude — tokens/custo dos agentes (estimativa do SDK)                            | ✅     | `api.test.ts`                                                                                                                                                                                                                                |
| Uso Claude — limites de sessão/semanais da assinatura                                | 🟡     | única fonte oficial: statusline do Claude Code via Desktop Bridge; sem bridge o painel diz “Dados de limite indisponíveis nesta integração.”                                                                                                 |
| Custo da organização (Admin API)                                                     | 🟡     | requer `ANTHROPIC_ADMIN_KEY`                                                                                                                                                                                                                 |
| Saldo de créditos pré-pagos                                                          | —      | não existe API oficial; exibido como indisponível                                                                                                                                                                                            |
| Executor Claude Managed Agents                                                       | ⏳     | interface `AgentExecutor` pronta para recebê-lo                                                                                                                                                                                              |

## Plataformas e entrega

| Item             | Status | Evidência / observação                                                                                                                                        |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versão web       | 🟢     | `expo export` + testes no Chromium (DEMO); deploy opcional no GitHub Pages via workflow                                                                       |
| APK Android      | 🟡     | `eas.json` (preview = APK), `expo-doctor` 21/21, `expo prebuild` OK; **build não executado** — requer `EXPO_TOKEN` e `EAS_PROJECT_ID` (docs/BUILD-ANDROID.md) |
| Backend em nuvem | 🟡     | Dockerfile pronto; precisa de hospedagem autorizada por você (docs/DEPLOY-BACKEND.md)                                                                         |
| Desktop Bridge   | ✅/🟡  | testes unitários; ainda não executado contra um Pixel Agents local real                                                                                       |

## Testes executados

| Suíte                                  | Resultado                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agency/shared`                        | 9/9                                                                                                                                                                                          |
| `agency/backend`                       | 40/40 (+1 opcional real: passou)                                                                                                                                                             |
| `agency/desktop-bridge`                | 4/4                                                                                                                                                                                          |
| `agency/app`                           | 2/2 + `tsc` sem erros                                                                                                                                                                        |
| `webview-ui` (original + embed)        | 89/89                                                                                                                                                                                        |
| `server` (original)                    | 532 passaram, 1 falhou: `rejects when the .claude directory is not writable` — falha porque o contêiner roda como root (permissões não se aplicam); nenhum arquivo de `server/` foi alterado |
| Lint, format, check-types, knip (raiz) | OK (1 aviso pré-existente em `App.tsx`)                                                                                                                                                      |
