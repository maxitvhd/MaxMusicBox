# MaxMusicBox — Guia de Integração Tauri v2 + Rust

Este documento descreve a arquitetura final da jukebox: frontend React (TypeScript +
Tailwind + Zustand) conectado ao backend nativo **Rust/Tauri v2**, com reprodução real
de MP3 via **rodio**, DSP por amostra, catálogo em **SQLite** e pagamentos **Pix reais
via Mercado Pago (marketplace com split)**.

---

## 1. Estrutura de arquivos

```text
├── src/                        # Frontend React + TypeScript + Tailwind
│   ├── services/
│   │   ├── tauriBridge.ts      # Bridge IPC (invoke/listen/emit) + fallback navegador
│   │   ├── nativeSync.ts       # Bootstrap (settings + catálogo) e assinatura de eventos
│   │   └── audioEngine.ts      # Motor WebAudio (somente fallback no navegador)
│   ├── store/useJukeboxStore.ts# Estado global (Zustand + persist)
│   └── components/             # UI (VU, spectrum, Pix, Rack Admin, etc.)
├── src-tauri/
│   ├── Cargo.toml              # tauri 2, rodio 0.19, rusqlite, lofty, ureq, tiny_http...
│   ├── tauri.conf.json         # Janela kiosk fullscreen + bundle
│   ├── capabilities/default.json
│   └── src/
│       ├── main.rs             # Estado, comandos IPC, emissor de telemetria (60 fps)
│       ├── audio.rs            # Thread de áudio (OutputStream/Sink !Send) + SFX
│       ├── dsp.rs              # EQ 5 bandas, compressor, AGC, limiter, master, FFT
│       ├── library.rs          # Scan recursivo, tags/capas (lofty), SQLite
│       ├── sfx.rs              # Gera o som "caixa registradora" (WAV)
│       └── mp.rs               # OAuth Mercado Pago, Pix com split, polling
├── snap/snapcraft.yaml         # Empacotamento Linux (snap)
├── .github/workflows/release.yml
├── .env.example                # Variáveis de ambiente (MP + biblioteca)
├── MUSICAS/                    # Biblioteca local (fonte do catálogo)
└── TAURI_RUST_CONNECT.md       # Este guia
```

---

## 2. Pré-requisitos

### macOS
```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
npm install
```

### Debian/Ubuntu (Linux)
```bash
sudo apt update && sudo apt install -y \
  build-essential curl pkg-config libssl-dev \
  libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  libasound2-dev
```

### Windows
Instale o **Microsoft C++ Build Tools**, o **WebView2 Runtime** e o Rust (MSVC toolchain).

---

## 3. Comandos IPC

Todos os comandos são invocados pelo frontend via `tauriBridge.invoke(nome, args)`.

### Biblioteca & catálogo
| Comando | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `get_catalog` | — | Retorna `{ categories, artists, tracks }` com capas em data URI |
| `library_info` | — | `{ path, trackCount }` da biblioteca atual |
| `rescan_library` | — | Reindexa a pasta atual e emite `library_scanned` |
| `set_library_path` | `{ path }` | Define a pasta e reindexa |
| `pick_music_folder` | — | Abre o seletor nativo e devolve o caminho escolhido |

### Reprodução & fila
| Comando | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `play_track` | `{ id }` | Toca a faixa no mixer rodio (retorna a faixa) |
| `play_track_by_code` | `{ code }` | Toca pela numeração do catálogo |
| `pause_track` / `resume_track` | — | Pausa/retoma |
| `skip_track` | — | Interrompe a faixa atual |
| `get_queue` / `sync_queue` | `{ queue }` (sync) | Espelha a fila do frontend no backend |
| `auto_dj_next` | — | Seleciona a próxima faixa (trava, agenda, overrides, histórico 20) |
| `play_sfx` | `{ name? }` | Toca o som da caixa registradora |

### DSP (parâmetros aplicados em tempo real por amostra)
| Comando | Parâmetros |
| :--- | :--- |
| `set_eq_band` | `{ band: 0..4, gain: -12..+12 }` |
| `set_compressor` | `{ threshold, ratio, attack?, release? }` |
| `set_agc` | `{ active, sensitivity? }` |
| `set_limiter_ceiling` | `{ ceiling: -12..0 }` |
| `set_master_gain` | `{ vol: 0..1.5 }` |

### Configurações, financeiro e Pix
| Comando | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `get_settings` | — | Tema, preço, split, PIN admin, Auto-DJ e status MP |
| `set_setting_value` | `{ key, value }` | Persiste uma configuração arbitrária |
| `set_autodj_config` | `{ config }` | Persiste a configuração do Auto-DJ |
| `get_theme` / `set_theme` | `{ theme }` | Tema atual (`neon-vinyl` \| `amp-vintage`) |
| `add_credits` | `{ amount, credits, method? }` | Grava transação no SQLite |
| `get_financial_report` | — | Relatório diário/mensal + histórico |
| `mp_oauth_start` | — | Abre o navegador para conectar a conta Mercado Pago |
| `mp_oauth_status` | — | `{ configured, connected, collectorId, expiresAt, splitPercent }` |
| `mp_disconnect` | — | Remove os tokens salvos |
| `create_pix_charge` | `{ amount, credits }` | Cria cobrança Pix com `application_fee` e inicia o polling |

---

## 4. Eventos (Rust → frontend)

Uma thread em Rust emite telemetria a ~60 fps; o frontend assina via
`tauriBridge.listen` (centralizado em `nativeSync.ts`).

| Evento | Payload | Uso |
| :--- | :--- | :--- |
| `audio_levels` | `{ left, right, peakLeft, peakRight }` | VU meters analógicos |
| `audio_spectrum` | `number[16]` | Visualizador espectral (FFT real) |
| `playback_progress` | `{ position_ms, duration_ms, playing }` | Barra de progresso |
| `track_ended` | `{}` | Próxima da fila ou Auto-DJ |
| `library_scanned` | `{ count }` | Recarrega o catálogo |
| `pix_created` | `PixCharge` | Exibe QR Code / copia-e-cola |
| `pix_pago` | `{ tx_id, credits, amount, payment_id }` | Libera créditos + confete + som |
| `pix_failed` | `{ payment_id, status }` | Aviso de falha |
| `pix_expired` | `payment_id` | QR expirado |
| `mp_connected` | `MpStatus` | Confirma a conexão da conta |
| `mp_error` | `string` | Erro na integração Mercado Pago |
| `theme_changed` | `{ theme }` | Sincronização de tema |

---

## 5. Integração Pix (Mercado Pago marketplace)

1. O administrador preenche `.env` (ver `.env.example`) e clica em **Conectar Mercado
   Pago** no Rack Admin.
2. `mp_oauth_start` sobe um servidor local (`tiny_http`) em `MP_REDIRECT_URI`, abre o
   navegador e troca o `code` por `access_token`/`refresh_token` (salvos no SQLite).
3. Em cada recarga, `create_pix_charge`:
   - renova o token se necessário;
   - cria o pagamento `payment_method_id = "pix"` com `application_fee` = `MP_SPLIT_PERCENT`;
   - retorna `qr_code_base64` e o código copia-e-cola;
   - inicia uma thread de **polling** a cada 4s (sem webhook público).
4. Ao aprovar, o backend grava a transação, toca o som da caixa e emite `pix_pago`;
   o frontend libera os créditos e, se houver playlist pendente, monta a fila.

---

## 6. Executar e empacotar

```bash
# Desenvolvimento (Vite + backend Rust com live reload)
npm run tauri dev

# Build de produção (bundles nativos)
npm run tauri build
```

Artefatos:
- macOS: `src-tauri/target/release/bundle/{dmg,macos}/`
- Linux: `src-tauri/target/release/bundle/{deb,appimage,rpm}/`
- Windows: `src-tauri/target/release/bundle/{msi,nsis}/`
- Snap: `snapcraft` na raiz (usa `snap/snapcraft.yaml`)

---

## 7. Modo quiosque no boot (Linux)

```bash
# ~/.config/openbox/autostart
xset s off -dpms
unclutter -idle 1 -root &
/usr/bin/maxmusicbox &
```

A janela é aberta em tela cheia, não redimensionável, travando o quiosque.
