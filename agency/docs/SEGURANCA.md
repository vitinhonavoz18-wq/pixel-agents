# Segurança

## Credenciais

- Chaves da Anthropic, do GitHub e de admin existem **apenas** no ambiente do backend.
- O app guarda só a URL do backend e um token de acesso (Android Keystore via `expo-secure-store`; na Web, `localStorage` — use um token restrito e revogue ao terminar).
- Tokens de API: 32 bytes aleatórios (`pa_…`), armazenados como hash SHA-256, verificados em tempo constante, com escopos (`admin`, `app`, `bridge`), lista de projetos e **revogação** (`DELETE /api/tokens/:id`).

## Autorização

- Um projeto só executa missões depois de **autorizado** (por um admin) e somente com repositórios que o token GitHub do backend já enxerga (opcionalmente filtrados por `AGENCY_ALLOWED_REPO_OWNERS`).
- Tokens `app` podem ser restritos a projetos; eventos do WebSocket são filtrados pelo mesmo critério.

## Isolamento da execução

- Cada missão roda num **clone novo** do repositório, numa branch própria `pixel-agency/<missão>`; missões paralelas nunca compartilham diretório. Um agente só executa uma missão por vez.
- O token do GitHub é passado ao `git` como cabeçalho de uso único — nunca no `.git/config`, na URL remota ou no ambiente do agente.
- O processo do Claude Code recebe um **ambiente mínimo** (sem `AGENCY_*`, sem token do GitHub) e `settingSources: []` — hooks e configurações do repositório clonado **não** são carregados (evita execução de comandos definidos pelo repositório).

## Política de ferramentas (`backend/src/policy.ts`)

Aplicada em duas camadas: hook `PreToolUse` (todas as chamadas) e `canUseTool` (aprovação humana).

| Decisão                   | Exemplos                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sempre negado**         | `rm -rf /`/`~`, `sudo`, `mkfs`/`dd`, fork bomb, desligar a máquina, `git push --force`, reescrita de histórico, `curl … \| sh`, `env`/`printenv`/`/proc/*/environ`, `$ANTHROPIC_*`/`$AGENCY_*`/`$GITHUB_TOKEN`, `ssh`/`scp`/`nc`, `crontab`/`systemctl` |
| **Sempre pede aprovação** | `git push`, `npm publish`, deploys (Vercel, Netlify, Firebase, Fly…), `eas submit`, `kubectl apply`, `terraform apply`, `docker push/run`, `gh pr create/merge`, requisições HTTP de escrita, `rm -r`, `git reset --hard`                               |
| Arquivos                  | Leitura/escrita só dentro do workspace; `.env*`, chaves privadas, `credentials*.json` e `.git/` internos são protegidos                                                                                                                                 |
| Autonomia                 | _Supervisionado_: só leitura sem pedir; _Padrão_: edita e roda comandos de desenvolvimento conhecidos; _Autônomo_: tudo o que a política permite. Comandos compostos (`a && b`, `;`, pipes) são avaliados parte a parte                                 |

Aprovações expiram (`AGENCY_APPROVAL_TIMEOUT_MIN`) e são negadas ao cancelar a missão.

## Outros controles

- Rate limiting por token/IP (`AGENCY_RATE_LIMIT_PER_MIN`).
- Log de auditoria append-only (`data/audit.jsonl`, `GET /api/audit`).
- Imagens servidas por URLs assinadas (HMAC, 24 h), com `nosniff` e CSP `sandbox` (SVG sem scripts); uploads validados por _magic bytes_ e limitados a 6 MB.
- Captura de telas (Playwright) só na origem configurada do projeto (proteção contra SSRF) e somente se `AGENCY_ENABLE_CAPTURE=1`.
- Teto de gasto por missão (`AGENCY_MAX_BUDGET_USD`) e tempo máximo (`AGENCY_MISSION_TIMEOUT_MIN`).

## Riscos residuais (conhecidos)

- O processo do Claude Code precisa da `ANTHROPIC_API_KEY` no próprio ambiente. A política bloqueia as formas óbvias de lê-la, mas não é uma barreira perfeita contra um agente determinado. Mitigações recomendadas: chave dedicada com limite de gasto no console, contêiner sem outros segredos e saída de rede restrita (allowlist: `api.anthropic.com`, `github.com`, registries de pacotes).
- Comandos de build/teste do repositório executam código do próprio repositório. Autorize apenas repositórios seus.
