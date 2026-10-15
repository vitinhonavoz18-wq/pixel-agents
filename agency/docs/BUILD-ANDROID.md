# APK Android pela nuvem (Expo EAS)

Tudo pelo navegador do tablet — sem Android Studio e sem computador.

## Uma vez só

1. Crie uma conta gratuita em **expo.dev** e um projeto chamado `pixel-agency`. Copie o **Project ID**.
2. Em expo.dev → _Account settings → Access tokens_, crie um token.
3. No GitHub do repositório → _Settings → Secrets and variables → Actions_:
   - **Secret** `EXPO_TOKEN` = o token do passo 2
   - **Variable** `EAS_PROJECT_ID` = o Project ID do passo 1

## Gerar o APK

GitHub → _Actions_ → **PIXEL AGENCY** → _Run workflow_ → marque **Gerar APK** → _Run_.

O workflow roda os testes e inicia o build no EAS (`eas build --platform android --profile preview`, perfil com `android.buildType = "apk"`). Acompanhe em expo.dev → _Builds_; ao terminar, a página do build tem o link de download e um QR code para instalar no tablet (permita “instalar apps desconhecidos” para o navegador).

## Pelo terminal (quando houver um disponível)

```bash
cd agency/app
npx eas-cli login
EAS_PROJECT_ID=<id> npx eas-cli build --platform android --profile preview
```

## Perfis (`app/eas.json`)

| Perfil       | Saída | Uso                       |
| ------------ | ----- | ------------------------- |
| `preview`    | APK   | instalar direto no tablet |
| `production` | AAB   | Google Play               |

## O que vai no APK

Somente o app e o escritório offline (`assets/office/office.html`). **Nenhum segredo**: URL do backend e token são digitados em _Config_ e o token fica no Android Keystore.

Permissões: `INTERNET` e `POST_NOTIFICATIONS` (alertas de aprovação/consumo). Localização, microfone, contatos, sobreposição de janela e armazenamento legado são bloqueados no `app.config.ts`.

## Validações já feitas neste ambiente

- `npx expo-doctor`: 21/21 verificações OK.
- `npx expo prebuild --platform android`: gera o projeto nativo sem erros (pasta não versionada; o EAS a gera no build).
- O build EAS em si **ainda não foi executado**: depende do seu login/token Expo.
