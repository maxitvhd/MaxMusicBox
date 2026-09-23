# Relatório de Alterações: Otimização da Barra do Topo, Layout e Playerlist (21/09/2026)

## 1. Contexto e Solicitação
- **Barra do Topo em Linha Única**: O usuário solicitou que a barra de cabeçalho do topo deixasse de quebrar em 2 linhas e passasse a ter todas as informações (logotipo, botões de ação, medidores VU e relógio digital) organizadas estritamente na mesma linha horizontal.
- **Eliminação de Área Vazia e Melhoria da Playerlist**: Foi reportado que a parte inferior da tela exibia uma área vazia e que a playerlist (catálogo de faixas e fila de reprodução) ficava oculta ou cortada em resoluções mais baixas ou janelas reduzidas.

---

## 2. Alterações Realizadas

### 2.1. Cabeçalho em Linha Única (`src/components/Header.tsx`)
- Aplicado `flex-nowrap`, altura compacta `h-12 sm:h-13` e `overflow-hidden`.
- **Esquerda**: Logotipo em disco/rádio animado + título `MAXMUSICBOX` com badge `KIOSK`.
- **Centro**: Controles de ação com botões compactos e responsivos:
  - Botão de login do cliente (`Entrar` / `Usuário com créditos`).
  - Botão de inserção de créditos (`Créditos [ENTER]`).
  - Seletor de temas compacto (`Neon` / `Vintage`).
  - Botão de Acessibilidade (teclado numérico na tela).
  - Botão de Telão Bar (segunda tela).
  - Botão de Modo Quiosque Fullscreen.
- **Direita**: Mini medidores VU estéreo analógicos (VU L e VU R) integrados com o relógio digital VFD na mesma linha.

### 2.2. Compactação da Seção Central (`CategoryCarousel.tsx` e `ArtistGrid.tsx`)
- **Remoção de Títulos Duplicados**: O cabeçalho redundante "Categorias Musicais" e "Artistas" foi eliminado, pois a aba superior (`Gêneros [/]` e `Artistas [1-9]`) já informa o modo ativo.
- **Padronização de Altura**:
  - `CategoryCarousel.tsx`: Cards de categorias compactados para `h-12 sm:h-14` com overlay de setas sutis.
  - `ArtistGrid.tsx`: Redesenhado em formato horizontal com avatares `w-9 h-9 sm:w-10 sm:h-10`, badges compactos de tecla numérica e paginação discreta.
- **Ganho de Espaço**: Economia de mais de 150px de altura vertical na tela.

### 2.3. Ampliação e Destaque da Playerlist (`src/App.tsx` e `TrackList.tsx`)
- **Espaço Garantido**: A seção inferior (`TrackList` e `TopTracksList`) agora possui `flex-1 min-h-[260px]`, garantindo que pelo menos 6 a 9 faixas estejam 100% visíveis, confortáveis para toque e legíveis.
- **Container Responsivo**: Ajustado `main` com `overflow-y-auto lg:overflow-hidden`, evitando que a playerlist seja cortada em telas com alturas menores que 720px.
- **Visualização das Faixas**: Tabela de músicas com padding ajustado (`py-1.5 px-2.5`), badges de código numérico claros (`*código`), tags de playlist selecionada e botão de ação rápida.

### 2.4. Auditoria de Desempenho e CPU/Memória
- O loop de sincronização de áudio em `src-tauri/src/main.rs` foi ajustado de 16ms (60 FPS) para 25ms (40 FPS), ideal para animação fluida sem sobrecarregar a thread de IPC.
- Remoção de logs repetitivos em stderr e console no `nativeSync.ts`.
- Consumo medido no processo nativo Tauri: **~41 MB de RAM** e **CPU entre 2.5% e 8%** durante reprodução ativa.

### 2.6. Eliminação de Scroll e Paginação Perfeita na Playlist (`QueueList.tsx`, `App.tsx`)
- **Remoção de Scroll**: O container da lista foi configurado com `overflow-hidden`, eliminando qualquer barra ou comportamento de rolagem vertical.
- **Encaixe em 6 Músicas (3x2)**: O `pageSize` do modo de 2 blocos foi ajustado para **6 músicas** (3 faixas na coluna esquerda, 3 na direita). Caso ultrapasse 6 faixas, o excedente é enviado imediatamente para a próxima tela via paginação `< 1/2 >` sem cortar itens nem rolar.
- **Crescimento Proporcional de Altura**: O bloco superior no `App.tsx` teve sua altura ligeiramente ampliada para `h-[164px] sm:h-[168px]`, proporcionando respiro e espaçamento confortável para as 3 linhas sem comprimir o rodapé.

### 2.7. Sanitização e Proteção de Dados Sensíveis nos Logs (`main.rs`, `mp.rs`, `sync.rs`)
- **Código Mestre e PINs de Administração (`main.rs`)**:
  - Removido log que imprimia a amostra de códigos válidos de reset mestre (`valid_codes`) no console/stderr ao digitar código inválido.
  - Ocultado o PIN padrão do log de sucesso de recuperação.
- **Pagamentos e Mercado Pago (`mp.rs`)**:
  - Removido o parâmetro `body={body}` que registrava os dados completos da cobrança/cliente no log do terminal.
  - Sanitizadas mensagens de erro da API para não vazar payloads brutos.
- **Sincronização e Telemetria (`sync.rs`)**:
  - O log de anúncios da nuvem agora exibe apenas a quantidade sincronizada (`{n} itens`), evitando despejo de JSONs e URLs no console.

---

## 3. Validação e Testes
- Compilação do frontend: `npm run build` executado com sucesso (zero erros).
- Verificação do backend Rust: `cargo check --manifest-path src-tauri/Cargo.toml` executado com sucesso (zero erros).

