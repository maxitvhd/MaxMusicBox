# Documentação Técnica: Alterações Mercado Pago, Admin Seguro e Navegação Kiosk 17 Teclas

**Data:** 18/09/2026  
**Horário:** 19:15 (Horário de Brasília)  
**Sistema:** MaxMusicBox v1.0.0 (Jukebox / Totem Comercial)  
**Desenvolvido por:** Rede Máximo em Soluções (www.maximo.tec.br)  

---

## 1. Visão Geral das Alterações

Este documento detalha as atualizações implementadas no **MaxMusicBox** para atender aos requisitos operacionais e comerciais de totens de autoatendimento jukebox:

1. **Mercado Pago Híbrido (Conta Direta do Programa vs OAuth do Operador com Split)**.
2. **Sistema de Segurança do Painel Admin (Senha Padrão, Alteração e Recuperação por Código Mestre)**.
3. **Correção e Melhoria do Teclado no Modal PIX (Desbloqueio de PINs iniciados por 1, 2, 3 e 4)**.
4. **Navegação Ergonômica Kiosk para Teclado Numérico de 17 Teclas com Coexistência de Touch/Mouse**.
5. **Telas Dedicadas em Tela Cheia para Seleção de Gêneros, Artistas, Músicas e Top Sucessos Dinâmico**.
6. **Aba de Créditos e Identificação da Maximo Tecnologias Brasil no Painel Admin e Console**.

---

## 2. Mercado Pago Híbrido (Direto vs Split)

### 2.1. Como Funciona

- **Cenário A - Operador Desconectado / Não Conectou (Modo Nativo do Programa):**
  - Quando nenhuma conta OAuth de operador está conectada (`is_oauth == false`), o sistema retorna `connected = false`.
  - No Painel Admin e modais, o status é exibido como **"DESCONECTADO (Sem Conta de Operador)"**.
  - As cobranças PIX utilizam em modo contingência as credenciais nativas do programa no arquivo `.env` (`MP_ACCESS_TOKEN`) **SEM SPLIT** (`application_fee = 0`), destinando 100% da recarga à plataforma.
- **Cenário B - Operador Conectou sua Conta Mercado Pago via OAuth (Modo Split):**
  - O operador autentica no Painel Técnico usando o fluxo OAuth do Mercado Pago.
  - O token do operador é salvo de forma segura em `secrets.json`.
  - O status passa para **"OAUTH CONECTADO (SPLIT X%)"** (`connected = true`, `is_oauth = true`).
  - Todas as cobranças PIX passam a ser geradas na conta do operador aplicando a taxa de divisão configurada (`application_fee` com a porcentagem definida em `MP_SPLIT_PERCENT`, ex: 5%).
- **Mecanismo de Desconexão Completa:**
  - Ao clicar em **"Desconectar Conta do Operador"**, a função `mp::disconnect()` zera e remove completamente o arquivo `secrets.json` do disco, dispara o evento IPC `mp_disconnected` e força o estado frontend para `connected = false` e `is_oauth = false`.

### 2.2. Arquivos Modificados
- `src-tauri/src/mp.rs`:
  - `status()` agora define `connected = oauth_token` (apenas verdadeiro quando houver conta OAuth de operador ativa).
  - `disconnect()` limpa e apaga `secrets.json` por completo.
- `src-tauri/src/main.rs`:
  - `mp_disconnect` emite o evento IPC `mp_disconnected` e retorna o novo `MpStatus` zerado.
- `src/services/nativeSync.ts`:
  - Escuta o evento `mp_disconnected` e atualiza a store no frontend.
- `src/components/PixModal.tsx`:
  - Exibe no rodapé o indicador visual da conta de recebimento.
- `src/components/AdminRackModal.tsx`:
  - Exibe a badge destacada de estado **DESCONECTADO** quando não há conta OAuth de operador e permite conectar/desconectar instantaneamente.

---

## 3. Segurança do Painel Admin e Recuperação por Código Mestre

### 3.1. Senha Padrão e Alteração
- **Senha Padrão de Instalação:** `1234`.
- O operador pode alterar a senha para qualquer sequência de 4 a 6 dígitos numéricos na Aba 3 (Financeiro / Segurança) do Painel Admin.
- A nova senha é salva de forma persistente no banco de dados SQLite (`settings.admin_pin`).

### 3.2. Recuperação por Código Mestre (Suporte Técnico)
Caso o operador altere a senha e a esqueça:
1. No teclado de autenticação do Admin, o operador clica em **"Esqueceu a senha? Recuperação com Código Mestre"**.
2. A tela exibe a instrução para o operador **ligar para o suporte da Rede Máximo em Soluções** informando que precisa resetar a máquina.
3. O operador **NÃO SABE** a fórmula matemática.
4. O técnico do suporte consulta o relógio/data e calcula:
   $$\text{Código} = (\text{Hora Atual} + \text{Dia do Mês} + \text{Ano}) \times 3$$
   *(O sistema possui tolerância de $\pm 1$ hora para evitar falhas durante a ligação na virada de hora).*
5. O técnico dita o número para o operador por telefone.
6. Ao digitar o código e confirmar:
   - A senha do painel é automaticamente **resetada para a senha padrão de instalação (`1234`)**.
   - O painel é desbloqueado e o operador recupera o controle do totem.

### 3.3. Arquivos Modificados
- `src-tauri/src/main.rs`:
  - Comandos Rust `set_admin_pin` e `verify_and_reset_admin_pin`.
- `src/components/AdminRackModal.tsx`:
  - Modal de recuperação seguro, sem revelar o algoritmo na interface.

---

## 4. Correção do Teclado no Modal PIX

### 4.1. O Problema Anterior
No `PixModal.tsx`, as teclas `1`, `2`, `3` e `4` estavam interceptando a troca de pacotes de crédito quando o campo do PIN estava vazio. Isso impedia o cliente de digitar qualquer PIN que começasse com `1`, `2`, `3` ou `4` (por exemplo, o PIN `4321` ou `12345`).

### 4.2. A Solução
- Todas as teclas numéricas `0` a `9` agora alimentam **exclusivamente** o campo de PIN de 5 dígitos do cliente.
- A troca de pacotes de crédito pelo teclado físico foi mapeada para as teclas `+` e `-` (ou `/`), além de botões clicáveis de alto contraste para touch e mouse.

---

## 5. Navegação Ergonômica de 17 Teclas e Coexistência com Touch/Mouse

### 5.1. Filosofia de Controle
O sistema foi desenhado primariamente para quiosques jukebox operados por **teclado numérico USB de 17 teclas**, mantendo suporte integral a telas sensíveis ao toque (touchscreen) e mouse tradicional:
- Cada item na tela possui um indicador numérico destacado (`[1]`, `[2]`, `[3]`, etc.).
- Um anel de foco dinâmico com brilho neon indica visualmente o elemento sob o cursor do teclado numérico.
- O clique com o mouse ou toque direto nos cartões, botões e barras de rolagem continua funcionando com total precisão.

### 5.2. Mapeamento de Teclas

| Tecla Numérica | Ação na Tela Principal (Totem) | Ação na Tela Dedicada (Navegador) |
| :--- | :--- | :--- |
| **8** | Move o cursor para cima (▲) | Move o foco para cima (▲) na grade |
| **2** | Move o cursor para baixo (▼) | Move o foco para baixo (▼) na grade |
| **4** | Página anterior / Esquerda (◄) | Move o foco para a esquerda (◄) |
| **6** | Próxima página / Direita (►) | Move o foco para a direita (►) |
| **5** ou **Enter** | Confirma / Abre a tela da seção selecionada | Adiciona ou remove faixa da playlist |
| **0** | Play / Pause da música tocando | Play / Pause da música tocando |
| **+** (Mais) | Avança página de itens | Avança para a próxima página de músicas |
| **-** (Menos) | Volta página ou limpa filtros ativos | Volta página ou fecha a tela dedicada |
| **,** (Vírgula) | Alterna seções (Categorias, Artistas, etc.) | Alterna o modo da tecla Enter (Seleção vs Play/Pause) |
| **/** (Barra) | Atalho rápido para modo Categorias | Filtra por categorias |
| ***** (Asterisco)| Atalho para digitar código da música (*01, etc.) | Digitação de código numérico |
| **0000 + Enter** | Desconecta / Logout da conta do cliente | Fecha sessão do cliente |
| **9999 + Enter** | Abre o Painel Técnico Admin | Abre o Painel Técnico Admin |

---

## 6. Telas Dedicadas em Tela Cheia e Top Sucessos Dinâmico

### 6.1. Exibição Completa por Categoria, Artista, Músicas e Top 15
- Ao selecionar uma Categoria, um Artista, a seção de Músicas ou o Top 15, o sistema abre o componente `MusicBrowserModal` ocupando a tela inteira.
- A grade é dimensionada para exibir **18 faixas por tela** (3 colunas por 6 linhas), eliminando cortes ou barras de rolagem excessivas.
- O Top Sucessos não fica engessado em 15 faixas: exibe todas as faixas que couberem confortavelmente e utiliza paginação (`+` e `-`) se houver mais músicas no ranking.

---

## 7. Sobre / Créditos da Rede Máximo em Soluções

- Adicionada a **Aba 7: Sobre / Créditos** no Painel Admin com a marca institucional da **Rede Máximo em Soluções**, versão do software e links oficiais para suporte e aquisição de licenças em [www.maximo.tec.br](https://www.maximo.tec.br).
- Inclusão do cabeçalho corporativo no console do navegador via `src/main.tsx` conforme especificado nas diretrizes do projeto.

---

## 8. Comandos de Validação e Teste

```bash
# Validação do Frontend (TypeScript + Vite)
npm run build

# Validação do Backend (Rust + Tauri v2)
cd src-tauri && cargo check
```

---

## 9. Seleção de Pasta de Músicas Multi-Sistema (Linux Debian, Mac, Windows, Android)

### 9.1. O Problema nos Sistemas Linux Debian
Em distribuições Linux Debian / Ubuntu ou sistemas embarcados sem utilitários GTK nativos (`zenity`, `kdialog` ou `xdg-desktop-portal`), a chamada ao seletor gráfico de arquivos de terceiros pode falhar ou travar sem abrir nenhuma janela.

### 9.2. Solução Implementada
1. **Entrada de Texto Direta no Admin:**
   - Adicionado campo de texto no Painel Admin em **3. Financeiro / Pasta de Músicas** onde o usuário pode digitar ou colar qualquer caminho do sistema operacional (ex: `/home/usuario/Musicas`, `~/Musicas`, `C:\MUSICAS` ou `/media/usb`).
   - Botão **"Salvar Pasta & Indexar"** envia o caminho diretamente ao backend Rust (`set_library_path`).
2. **Expansão de Atalho `~` no Backend Rust:**
   - Em `src-tauri/src/main.rs`, caminhos iniciados por `~/` são expandidos automaticamente para a pasta HOME do usuário no Linux e macOS.
3. **Proteção de Seletor Visual (`pick_music_folder`):**
   - A chamada `pick_music_folder` foi envolvida em bloco protegido `catch_unwind`. Caso o diálogo GTK não responda, o sistema devolve uma mensagem orientando o usuário a colar o caminho na caixa de texto.
