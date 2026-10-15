# Deploy do backend (nuvem)

O backend precisa de: Node 20+, `git`, disco persistente (dados, sessões do Claude, workspaces) e um processo de longa duração (missões podem levar dezenas de minutos e o WebSocket fica aberto). Plataformas _serverless_ com timeout curto não servem.

> Nenhum serviço pago foi contratado nem publicado. Escolha a infraestrutura e autorize os custos antes de subir.

## O que você precisa providenciar

| Item                             | Para quê                                                                                                              | Onde                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`              | Executar os agentes (Claude Agent SDK). **Login de assinatura claude.ai não é permitido para produtos de terceiros.** | console.anthropic.com → API Keys                                                                                                                                                |
| `AGENCY_GITHUB_TOKEN`            | Clonar os repositórios autorizados                                                                                    | GitHub → Settings → Developer settings → Fine-grained token (somente os repositórios desejados; _Contents: Read_ — _Read and write_ apenas se for permitir push após aprovação) |
| `AGENCY_ADMIN_TOKEN`             | Token inicial de administrador                                                                                        | gere um valor aleatório longo (ex.: `openssl rand -base64 48`)                                                                                                                  |
| Hospedagem com volume            | Rodar o contêiner                                                                                                     | ver opções abaixo                                                                                                                                                               |
| (opcional) `ANTHROPIC_ADMIN_KEY` | Custo da organização (Admin API)                                                                                      | console → Admin keys (só organizações)                                                                                                                                          |

## Imagem Docker

```bash
# na raiz do repositório
docker build -f agency/backend/Dockerfile -t pixel-agency-backend .
docker run -p 8787:8787 -v pixel-agency-data:/data --env-file agency/backend/.env pixel-agency-backend
```

O contêiner roda como usuário sem privilégios, com `tini`, dados em `/data`.

## Opções de hospedagem

| Opção                       | Observações                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| VPS pequena (2 vCPU / 4 GB) | Mais simples e previsível; Docker + volume local; coloque atrás de HTTPS (Caddy/Traefik).                     |
| Fly.io (Machine + Volume)   | Bom para contêiner com disco; configure `min_machines_running = 1` (não pode “dormir” no meio de uma missão). |
| Render / Railway            | Serviço web com disco persistente; garanta que o plano não suspende por inatividade.                          |

Custos variam por região e mudam com frequência — consulte as páginas de preço antes de contratar. O custo dominante tende a ser o **uso do Claude**: cada missão consome tokens (preço por milhão de tokens do modelo escolhido). Use `AGENCY_MAX_BUDGET_USD` (teto por missão, aplicado pelo SDK), `AGENCY_MAX_CONCURRENT_MISSIONS` e os alertas de custo do app.

## HTTPS e CORS

Exponha o backend somente via HTTPS. Para a versão web, defina `AGENCY_CORS_ORIGINS` com a origem exata do site (ex.: `https://seuusuario.github.io`).

## Alternativa gerenciada: Claude Managed Agents

A Anthropic oferece _Managed Agents_ (beta `managed-agents-2026-04-01`): o loop do agente e o sandbox rodam na infraestrutura da Anthropic. O backend já isola a execução atrás da interface `AgentExecutor` (`backend/src/executor/types.ts`); um executor Managed Agents pode substituir o `ClaudeAgentSdkExecutor` sem mudar app, eventos ou fila. Ainda não implementado nesta versão.

## Checklist pós-deploy

1. `GET /api/health` responde `ok`.
2. No app: Config → URL + token → “Testar” mostra `executor claude_agent_sdk`.
3. Projetos → conectar repositório → **autorizar** → “Extrair” identidade visual.
4. Delegue uma missão pequena (ex.: “liste os testes do projeto”) e acompanhe no escritório.
