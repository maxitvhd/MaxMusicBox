# ESPECIFICAÇÃO TÉCNICA E ARQUITETURAL: JUKEBOX PROFISSIONAL (TAURI + REACT + RUST)

## 1. Visão Geral do Sistema
Atue como um Engenheiro de Software Full-Stack (Especialista em Rust/Tauri e React/TypeScript). Sua missão é desenvolver uma Jukebox nativa para Linux. 
A aplicação rodará em ambiente desktop (modo quiosque/tela cheia) e utilizará exclusivamente arquivos de áudio locais (MP3/WAV), sem depender de APIs de streaming.

### 1.1 Stack Tecnológica
*   **Front-end:** React.js, TypeScript, Tailwind CSS, Zustand (para estado global), Framer Motion (para animações complexas).
*   **Back-end (Desktop App):** Rust com framework Tauri.
*   **Banco de Dados Local:** SQLite (gerenciado via Rust).
*   **Áudio/DSP:** Rust (bibliotecas como `rodio` e pipelines DSP customizados para EQ, Compressão e AGC).

---

## 2. Design System e Gerenciamento de Temas globais
O estado do tema deve ser gerenciado pelo Zustand e salvo no banco SQLite via Tauri. O sistema injeta as variáveis no CSS/Tailwind.

### 2.1 Tema 1: "Neon Vinyl" (Moderno/Retrô)
*   **Background:** Azul escuro fosco (`#0f172a`).
*   **Cores Primárias:** Ciano brilhante (`#06b6d4`) e Magenta (`#ec4899`) com efeitos de `box-shadow` simulando neon.
*   **Componentes Visuais:** Discos de vinil em SVG/WebP girando ao lado das faixas. Telas limpas, fontes *sans-serif* modernas.

### 2.2 Tema 2: "Amp Vintage" (Simulação Quasar/Analógico)
*   **Background:** Texturas de alumínio escovado escuro e painéis laterais de madeira (usar padrões CSS ou imagens locais).
*   **Cores Primárias:** Âmbar/Dourado (`#f59e0b`) e Vermelho (para picos de áudio).
*   **Tipografia:** Fontes monospace simulando displays VFD (Vácuo Fluorescente).
*   **Componentes Visuais:** Botões em *Neumorphism* (sombreamento pesado simulando botões físicos de acrílico/metal).

---

## 3. Especificação de Telas e Componentes (Front-end React)

### 3.1 Tela Principal (Home / Now Playing)
*   **Layout:** Grid responsivo, otimizado para touch.
*   **Header (Topo):**
    *   Logo da Jukebox à esquerda.
    *   Relógio digital centralizado (atualizado via `setInterval`).
    *   **VUs Analógicos (Miniatura):** Dois medidores (L e R) com ponteiros de agulha. Devem escutar eventos Tauri (`listen('audio_levels')`) a 60fps.
*   **Área Central (Fila e Auto-DJ):**
    *   **Componente "Tocando Agora":** Exibe a capa do álbum da música atual. Se no Tema 1, um vinil animado girando (`@keyframes spin`). Nome da música e artista rolando em letreiro (Marquee) se for longo.
    *   **Componente "Próximas da Fila":** Lista vertical mostrando até as 3 próximas músicas, com indicação de quem a escolheu (ou se foi o Auto-DJ).
*   **Carrossel de Categorias:**
    *   Rolagem horizontal (`overflow-x-auto`, `snap-x`).
    *   Cards de categorias musicais (Rock, Samba, etc.) com imagens representativas e efeito hover/press.
*   **Footer:**
    *   Botão "Admin" discreto (ícone de engrenagem) -> Abre modal pedindo PIN numérico.
    *   Botão "Inserir Créditos (Pix)" destacado em verde.

### 3.2 Telas de Navegação (Categorias -> Artistas -> Músicas)
*   **Grid de Artistas:** Cards circulares, animação de *fade-in* escalonada (`stagger` do Framer Motion) ao carregar.
*   **Tracklist (Lista de Músicas):**
    *   Tabela com: Código (ex: 01), Título, Duração (mm:ss), Valor (ex: 1 Crédito).
*   **Teclado Numérico (Keypad):**
    *   Componente lateral fixo. Teclas de `0-9`, `Corrigir` e `Confirmar`.
    *   Feedback tátil visual (o botão "afunda" ao ser clicado).

### 3.3 Modal de Pagamento Pix
*   **Interface:** Sobrepõe a tela atual com um fundo com desfoque (`backdrop-blur`).
*   **Elementos:** QR Code Pix dinâmico (gerado no backend e enviado base64 pro front).
*   **Timer Circular:** Um círculo SVG com `stroke-dashoffset` animado para mostrar o tempo restante do Pix.
*   **Feedback:** Ao receber o evento Tauri `pix_pago`, fechar modal, tocar arquivo de som `caixa_retro.mp3` e exibir animação de chuvas de moedas/créditos.

---

## 4. O Painel Admin: O "Rack Quasar" e Configurações

Esta é a área mais detalhada. Deve parecer um rack de áudio profissional no navegador/app.

### 4.1 Aba 1: Racks de Áudio (DSP)
*   **Design:** Painel metálico, parafusos falsos nos cantos, divisões por módulos.
*   **Módulo VU Máster:** Grandes VUs analógicos simulando a saída para as caixas.
*   **Módulo Equalizador (5 Bandas):**
    *   5 Knobs rotativos (Grave, Médio-Grave, Médio, Médio-Agudo, Agudo).
    *   Implementar a lógica de arrastar o mouse para cima/baixo para girar o botão rotativo em React, mapeando valores de -12dB a +12dB.
    *   Ao soltar o knob, dispara `invoke('set_eq', { band: id, value: db })`.
*   **Módulo Dynamics (Faders Deslizantes):**
    *   **AGC (Auto Gain Control):** Toggle (On/Off) e Fader de sensibilidade.
    *   **Compressor:** 4 botões rotativos (Threshold, Ratio, Attack, Release).
    *   **Limiter:** Fader de Ceiling (teto máximo) para não queimar as caixas.
    *   **Master Gain:** Fader longo estilo mesa de som.

### 4.2 Aba 2: Calendário Inteligente e Regras (Auto-DJ)
*   **Mapeamento Semanal:** Dropdowns para selecionar categorias base. (Ex: Selecionar "Forró" para todas as Quartas-feiras).
*   **Eventos Específicos:** Componente de calendário. O admin clica em uma data (ex: 12 de Outubro) e define uma categoria. Esta regra sobrescreve a regra semanal.
*   **Toggle "Travar Categoria":** Uma chave de ativação grande (estilo alavanca industrial). Quando ativa, oculta todas as outras categorias na tela principal e trava o Auto-DJ naquela categoria.

### 4.3 Aba 3: Financeiro
*   Tabela com limite de créditos, preço por música e relatórios locais SQLite de arrecadação do dia/mês.

---

## 5. Tela Secundária (Monitor de Áudio)
*   Se o usuário habilitar multi-monitores, a janela do Tauri cria uma tela em tela-cheia no monitor 2.
*   Esta tela exibe EXCLUSIVAMENTE o tema de áudio: O nome da música atual no centro e os VUs gigantes analógicos batendo e equalizadores gráficos de barra (Spectrum Analyzer). Fica visível o tempo todo para o público do bar/local ver o que está tocando.

---

## 6. Física de Animações e Comportamento
*   **Ponteiros dos VUs (Attack/Decay):** O backend em Rust enviará os picos de volume a cada 16ms. O front-end (React) não pode simplesmente "pular" o ponteiro. Use `requestAnimationFrame` ou Framer Motion (com `spring`) para aplicar inércia mecânica. O ponteiro sobe rápido (Attack) e desce suavemente (Decay), igual a um equipamento analógico real.
*   **Transições de Tela:** Otimizadas para não gargalar em hardware fraco. Use transições simples de opacidade (`opacity: 0` -> `opacity: 1`) com duração de 200ms.

---

## 7. Contrato de Integração Rust (Tauri Commands & Events)
O agente desenvolvedor Rust DEVE implementar os seguintes comandos IPC (`#[tauri::command]`):
*   **Áudio:** `play_track(id)`, `pause_track()`, `skip_track()`, `get_queue()`.
*   **DSP (Processamento de Sinal em tempo real):** `set_eq_band(band, gain)`, `set_compressor(threshold, ratio)`, `set_agc(active)`, `set_master_gain(vol)`.
*   O backend em Rust deve conter um worker de áudio em thread separada usando `rodio` e `cpal`, interceptando o buffer de áudio em tempo real para aplicar o EQ e o Compressor antes de enviar para a saída de som, simultaneamente emitindo os níveis RMS via `app_handle.emit_all("audio_levels", { left, right })`.

## 8. Lógica de Banco de Dados e Fila (SQLite no Rust)
*   Se a fila do usuário ficar vazia:
    *   Verifica se o Admin ativou a "Trava de Categoria".
    *   Se sim: Busca uma música aleatória no SQLite da categoria travada.
    *   Se não: Busca a categoria da última música que tocou. Puxa uma música aleatória daquela categoria.
    *   Garante que não repita as últimas 20 músicas tocadas (manter histórico em memória ou no SQLite).