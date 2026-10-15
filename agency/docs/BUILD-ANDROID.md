# APK Android

Tudo pelo navegador do tablet — sem Android Studio e sem computador. Há dois caminhos independentes.

## Caminho A — APK pronto no GitHub (sem conta Expo)

A cada push em `agency/`, o job **android_apk** do workflow _PIXEL AGENCY_ gera o APK com Gradle no GitHub Actions e publica uma _Release_ (pré-lançamento) `agency-v<versão>` com o arquivo `pixel-agency-<versão>.apk`.

GitHub → _Releases_ → **PIXEL AGENCY 1.0.0 (Android APK)** → baixe o `.apk` no tablet e instale (permita “instalar apps desconhecidos” para o navegador). Também fica como _artifact_ `pixel-agency-apk` na execução do workflow.

Esse APK é assinado com a chave de depuração do React Native: serve para instalar e testar, não para a Play Store.

## Caminho B — Expo EAS (expo.dev)

### Uma vez só (5 minutos, no expo.dev)

1. **expo.dev** → _Create a project_ → nome `PIXEL AGENCY`, slug **`pixel-agency`**. Copie o **Project ID**.
2. No projeto → _Project settings → GitHub_ → **Connect** e escolha o repositório `pixel-agents`.
   - **Base directory**: `agency/app` (é um monorepo — sem isso o EAS não encontra o app).
3. (Opcional, para disparar pelo GitHub Actions) expo.dev → _Account settings → Access tokens_ → crie um token. No GitHub → _Settings → Secrets and variables → Actions_: secret `EXPO_TOKEN` e variable `EAS_PROJECT_ID` (= Project ID).

O app não precisa de alteração: o `app.config.ts` lê o Project ID de `EAS_PROJECT_ID` ou de `extra.eas.projectId`. Se o EAS pedir o ID no build pelo site, defina a variável de ambiente `EAS_PROJECT_ID` em _Project settings → Environment variables_ (ambiente _preview_).

### Gerar o APK

- **Pelo site**: projeto → _Builds_ → **Build from GitHub** → plataforma _Android_, branch `claude/clever-noether-46zvxb` (ou `main` depois do merge), perfil **`preview`**.
- **Pelo GitHub**: _Actions_ → **PIXEL AGENCY** → _Run workflow_ → marque **Gerar APK** → _Run_.
- **Pelo terminal**:

  ```bash
  cd agency/app
  npx eas-cli login
  EAS_PROJECT_ID=<id> npx eas-cli build --platform android --profile preview
  ```

Ao terminar, a página do build no expo.dev tem o link de download e um QR code para instalar no tablet.

## Perfis (`app/eas.json`)

| Perfil       | Saída | Uso                       |
| ------------ | ----- | ------------------------- |
| `preview`    | APK   | instalar direto no tablet |
| `production` | AAB   | Google Play               |

## O que vai no APK

Somente o app e o escritório offline (`assets/office/office.html`). **Nenhum segredo**: URL do backend e token são digitados em _Config_ e o token fica no Android Keystore. Sem backend configurado o app abre em **MODO DEMO**, sinalizado na tela.

Permissões: `INTERNET` e `POST_NOTIFICATIONS` (alertas de aprovação/consumo). Localização, microfone, contatos, sobreposição de janela e armazenamento legado são bloqueados no `app.config.ts`.

## Validações feitas

- `npx expo-doctor`: 21/21 verificações OK.
- `npx expo prebuild --platform android`: gera o projeto nativo sem erros (pasta não versionada; o EAS/CI a gera no build).
- Build EAS: depende do projeto no expo.dev (passos acima) — a integração Expo disponível aqui só dispara builds de projetos já existentes e conectados ao GitHub.
