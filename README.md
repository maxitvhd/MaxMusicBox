<div align="center">
  <h1>🎶 MaxMusicBox</h1>
  <p><strong>Jukebox profissional de bar — terminal touch + teclado numérico físico</strong></p>
  <p>
    <strong>Tauri v2 (React + TypeScript) · Backend Rust (rodio + DSP) · SQLite · Mercado Pago (Pix)</strong>
  </p>
</div>

---

## Funcionalidades

- **Tela touch kiosk**: categorias, artistas e catálogo de faixas com teclado numérico virtual e físico ([1-9] seleciona, `*código` toca direto, `Enter` abre o Pix).
- **Áudio profissional**: DSP em tempo real (EQ de 5 bandas, compressor, AGC, limiter e master gain via `rodio` + `rustfft`).
- **Monitor de áudio**: VU meters, espectro e tela secundária (telão).
- **Auto-DJ inteligente**: agenda semanal, trava de categoria e datas especiais.
- **Pagamento Pix/Mercado Pago (marketplace)**: QR Code com split e confirmação automática.
- **Relatório financeiro**: arrecadação diária/mensal e histórico de transações em SQLite.
- **Contas de usuário**: acesso por senha única, com saldo próprio descontado ao tocar músicas.
- **Painel admin**: DSP, Auto-DJ, financeiro, teclado, reprodução livre e gestão de usuários.

## Rodar localmente

**Pré-requisitos:** Node.js, Rust (cargo) e [Tauri CLI v2](https://v2.tauri.app/).

```bash
npm install
npm run dev        # frontend (browser)
npm run desktop    # aplicativo nativo (Tauri)
```

Configuração (opcional): copie `.env.example` para `.env` e preencha as credenciais do
Mercado Pago (`MP_CLIENT_ID` e `MP_CLIENT_SECRET`) para Pix real.

## Estrutura

```
src/            Frontend React + Zustand
src-tauri/      Backend Rust (áudio, DSP, SQLite, MP, catálogo)
banco/          Banco SQLite operacional (ignorado no git)
MUSICAS/        Biblioteca local de músicas (ignorada no git)
```