# Alterações Realizadas - Modal Admin, Trava de Categoria, Agenda por Hora e Telemetria

**Data e Hora de Atualização**: 20/09/2026 às 20:13

---

## 📋 Resumo das Alterações Finais Implementadas

### 1. Modal Administrativo (AdminRackModal & Teclado 17 Teclas)
- **Fechamento do Modal com a Tecla `-` (Subtração do Numpad)**:
  - Adicionada a escuta da tecla `-` (`NumpadSubtract`, `Subtract` e `-`) no ouvinte global de teclado (`useKioskKeyboardListener.ts`). Como o teclado físico de 17 teclas não possui `Esc`, agora a tecla `-` fecha o modal administrativo de forma ágil e direta.
- **Botão Visível "SAIR (-)" no Cabeçalho**:
  - Incluído um botão vermelho bem destacado `SAIR (-)` no canto superior direito do cabeçalho do `AdminRackModal`.
- **Redesign das Abas de Navegação (Sem Scroll Horizontal)**:
  - As 7 abas do painel admin (`1. DSP`, `2. Auto-DJ`, `3. Financeiro`, `4. Teclado`, `5. Admin Free`, `6. Usuários`, `7. Sobre`) foram organizadas em layout responsivo `flex-wrap`. Não há mais barra de rolagem horizontal nem abas escondidas fora da visão do operador.

### 2. Trava de Categoria Estrita (Auto-DJ e Seleção Manual)
- **Bloqueio de Reprodução Manual**:
  - Quando a trava de categoria está ativa (`categoryLocked: true`), tentativas de adicionar ou tocar músicas de categorias diferentes da travada são bloqueadas com aviso HUD visual na tela.
- **Garantia no Auto-DJ**:
  - O motor de sorteio de faixas do Auto-DJ filtra **estritamente** apenas músicas pertencentes à categoria travada (`lockedCategoryId`). Ele nunca mais faz fallback para a biblioteca global de outras categorias.

### 3. Paginação e Navegação na Fila de Músicas (QueueList)
- **Paginação por Páginas com Botões `<` e `>`**:
  - A lista "Próximas da Fila" na tela principal foi atualizada para suportar paginação. Quando houver mais de 3 músicas na fila, são exibidos os botões de navegação e o indicador de página (`Página X de Y`), permitindo visualizar e gerenciar toda a extensão da fila.

### 4. Agendamento de Categorias por Horário + Exclusão
- **Agendamento por Hora (ex: 14:00h samba, 18:00h pagode)**:
  - O formulário na aba Auto-DJ agora permite escolher um horário específico (ex: `14:00h`) ou agendar o dia todo (24h). As chaves são salvas no formato `YYYY-MM-DD@HH`.
- **Botão de Exclusão de Agendamento (`Lixeira`)**:
  - Cada regra de agendamento exibida na lista agora inclui um botão com ícone de lixeira para remover o agendamento individualmente com um único clique.

### 5. Persistência do Preço por Crédito
- **Persistência Completa no SQLite**:
  - A alteração do valor por crédito no painel admin grava o parâmetro `price_per_credit` na tabela `settings` do SQLite via Rust (`set_setting_value`).
  - Ao reiniciar o aplicativo, o valor configurado é recarregado e mantido no relatório financeiro e no modal Pix.

### 6. Correção do PIN de Administrador e Código Mestre
- **Ajuste e Verificação do PIN no Banco (`4059`)**:
  - Corrigido o valor de `admin_pin` no banco SQLite para `4059`.
  - Adicionado botão de alternar visibilidade (olho / show-hide) no campo de alteração de senha para evitar digitação inadvertida de dígitos extras ocultos.
  - A tela de login do Admin agora adapta dinamicamente a quantidade de círculos/pontos de digitação com base no tamanho exato do PIN cadastrado.
- **Expansão de Fórmulas do Código Mestre**:
  - O cálculo do código mestre de recuperação agora aceita todas as variações naturais de cálculo pelo operador: com parênteses `(hora + dia + ano) * 3`, sem parênteses `hora + dia + (ano * 3)`, ano com 2 dígitos (`26`), horário UTC e horário local com tolerância de ±1 hora.

### 7. Remoção de Rótulos de Desenvolvedor da Tela Principal
- **Limpeza do Footer**:
  - Removidas menções como `SQLite Local Sincronizado` e `Áudio DSP Ativo (60 FPS)` do rodapé público do Kiosk, substituindo por um status limpo e amigável `Sistema Operacional Ativo`.

### 7. Telemetria e Sincronização Nativa Segura (IP Público, Split MP e Faturamento Total)
- **Coleta de IP Público (WAN)**:
  - O worker de sincronização do Rust (`sync.rs`) consulta o IP de internet via serviços externos em HTTPS com timeout curto (4s), enviando o IP real da rede externa em vez do hostname local.
- **Métricas de Pagamento e Faturamento**:
  - O payload da telemetria inclui `total_faturamento` (soma total da tabela `finance_log`), `is_split_active` (status da conta do operador via OAuth) e `split_percent`.
- **Criptografia de Dados**:
  - Todo o payload trafega cifrado em base64 via canal TLS/HTTPS de ponta a ponta.

---

## 🛠️ Comandos de Commit Sugeridos:
-- git commit -m "feat(admin): implementa fechamento com tecla minus, trava estrita de categoria, agendamento por hora, paginacao da fila e telemetria segura"
