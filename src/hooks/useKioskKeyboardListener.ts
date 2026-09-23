import { useEffect, useRef } from 'react';
import { useJukeboxStore, PAGE_SIZE } from '../store/useJukeboxStore';
import { audioEngine } from '../services/audioEngine';

type Store = ReturnType<typeof useJukeboxStore.getState>;

// Lista de faixas correspondente ao filtro/seção atual (para paginação e teclas 1-9).
const currentTrackList = (store: Store) => {
  if (store.selectedArtist) return store.tracks.filter((t) => t.artistId === store.selectedArtist!.id);
  if (store.selectedCategory) return store.tracks.filter((t) => t.category === store.selectedCategory!.id);
  return store.tracks;
};

// Lista de artistas correspondente ao filtro atual.
const currentArtistList = (store: Store) =>
  store.selectedCategory
    ? store.artists.filter((a) => a.categoryId === store.selectedCategory!.id)
    : store.artists;

export const useKioskKeyboardListener = () => {
  // Não assina a store inteira: lê sob demanda no handler para não re-renderizar
  // o app a cada evento de telemetria (60 fps).
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<number | null>(null);

  // Limpa o buffer de teclado com timeout
  const resetBufferAfterDelay = (delayMs: number = 3500) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      bufferRef.current = '';
      useJukeboxStore.getState().hideKioskHud();
    }, delayMs);
  };

  useEffect(() => {
    const clearPendingInput = () => {
      bufferRef.current = '';
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const unsubscribe = useJukeboxStore.subscribe((state, previous) => {
      if (state.isPixModalOpen && !previous.isPixModalOpen) clearPendingInput();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const store = useJukeboxStore.getState();

      // Quando o Modal Pix está aberto, os eventos de teclado numérico são processados pelo próprio PixModal
      if (store.isPixModalOpen) {
        clearPendingInput();
        return;
      }

      // Quando a Tela Dedicada de Seleção (MusicBrowserModal) está aberta, os eventos de 17 teclas são processados por ela
      if (store.browserOpen) {
        clearPendingInput();
        return;
      }

      // Quando o Modal de Admin está aberto, Escape ou tecla [-] fecha
      if (store.isAdminModalOpen) {
        if (e.key === 'Escape' || e.key === '-' || e.code === 'NumpadSubtract' || e.key === 'Subtract') {
          e.preventDefault();
          store.setAdminModalOpen(false);
        }
        return;
      }

      // Quando o Modal de Login manual está aberto
      if (store.isUserLoginOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          store.setUserLoginOpen(false);
        }
        clearPendingInput();
        return;
      }

      // Não intercepta se o foco estiver em um campo de texto de formulário
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key;

      // 0. VÍRGULA / PONTO (, / .) ou NumpadDecimal: Alterna Seções do Totem
      if (key === ',' || key === ';' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        const curSec = store.activeSection;
        const sections: ('categories' | 'artists' | 'tracks' | 'top15')[] = [
          'categories',
          'artists',
          'tracks',
          'top15'
        ];
        const nextIdx = (sections.indexOf(curSec) + 1) % sections.length;
        const nextSec = sections[nextIdx];
        store.setActiveSection(nextSec);
        store.showKioskHud(
          `Seção: [ ${nextSec.toUpperCase()} ]`,
          'Teclas [1-9] selecionam | [+] / [-] paginam | [0] play/pause | [,] alterna',
          'info',
          3500
        );
        return;
      }

      // 1. ENTER / NUMPAD ENTER
      if (key === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        const currentBuffer = bufferRef.current.trim();

        // 1a. Sair da Conta (Logout): 0000 ou *0000
        if (currentBuffer === '0000' || currentBuffer === '*0000') {
          bufferRef.current = '';
          store.logoutUser();
          return;
        }

        // 1b. Painel Técnico Admin: 9999 ou *9999
        if (currentBuffer === '9999' || currentBuffer === '*9999') {
          bufferRef.current = '';
          store.setAdminModalOpen(!store.isAdminModalOpen);
          store.showKioskHud('Painel Técnico Admin', 'Acesso de configuração do operador', 'info', 3000);
          return;
        }

        // 1c. Telão do Bar (TV 2): 8888 ou *8888
        if (currentBuffer === '8888' || currentBuffer === '*8888') {
          bufferRef.current = '';
          store.setSecondaryScreenOpen(!store.isSecondaryScreenOpen);
          store.showKioskHud('Telão do Bar (TV 2)', 'Alternando tela secundária', 'info', 3000);
          return;
        }

        // 1d. Alternar Tema (Neon Vinyl <-> Amp Vintage): 7777 ou *7777
        if (currentBuffer === '7777' || currentBuffer === '*7777') {
          bufferRef.current = '';
          const nextTheme = store.theme === 'neon-vinyl' ? 'amp-vintage' : 'neon-vinyl';
          store.setTheme(nextTheme);
          store.showKioskHud('Tema Alterado', nextTheme === 'amp-vintage' ? 'Amp Vintage' : 'Neon Vinyl', 'success', 3000);
          return;
        }

        // 1e. Pular Música (Skip Track): 6666 ou *6666 ou *0 ou 00
        if (currentBuffer === '6666' || currentBuffer === '*6666' || currentBuffer === '*0' || currentBuffer === '00') {
          bufferRef.current = '';
          store.skipTrack();
          store.showKioskHud('Música Pulada', 'Tocando próxima faixa da fila', 'info', 3000);
          return;
        }

        // 1f. Teclado Virtual de Acessibilidade: 5555 ou *5555
        if (currentBuffer === '5555' || currentBuffer === '*5555') {
          bufferRef.current = '';
          store.setAccessibilityKeypadOpen(!store.isAccessibilityKeypadOpen);
          store.showKioskHud('Teclado Virtual', 'Aberto na tela', 'info', 3000);
          return;
        }

        // 1g. Fast Login / Carregar Créditos via PIN de 5 dígitos: 12345 ou *12345
        const cleanPin = currentBuffer.replace('*', '');
        if (/^\d{5}$/.test(cleanPin)) {
          bufferRef.current = '';
          store.authenticateUser(cleanPin);
          return;
        }

        // 1h. Se houver Playlist pendente selecionada: confirma e toca!
        if (store.userPlaylist.length > 0 && !currentBuffer) {
          const totalCost = store.userPlaylist.reduce((acc, t) => acc + t.cost, 0);
          const availableCredits = store.currentUser ? store.currentUser.credits : store.credits;
          if (availableCredits >= totalCost) {
            store.commitUserPlaylist();
            return;
          } else {
            store.setPixModalOpen(true);
            audioEngine.playCashRegisterSound();
            store.showKioskHud(
              `Recarregar Pix: Playlist custa ${totalCost} cr`,
              `Você possui ${availableCredits} crédito(s). Adicione créditos para tocar`,
              'warning',
              3500
            );
            return;
          }
        }

        // 1i. Execução direta de música via *código
        if (currentBuffer.startsWith('*') && currentBuffer.length > 1) {
          const code = currentBuffer.substring(1);
          executeTrackByCode(code);
          bufferRef.current = '';
          return;
        }

        // 1j. Seleção de categoria via /número
        if (currentBuffer.startsWith('/') && currentBuffer.length > 1) {
          const catStr = currentBuffer.substring(1);
          executeCategoryByCodeOrNumber(catStr);
          bufferRef.current = '';
          return;
        }

        // 1k. Navegação remota contextual
        if (store.activeSection === 'categories' && store.selectedCategory) {
          store.setActiveSection('artists');
          store.showKioskHud('Seção: Artistas', 'Escolha o cantor pelo número [1-9] ou [+/-]', 'info', 2500);
          return;
        }
        if (store.activeSection === 'artists' && store.selectedArtist) {
          store.setActiveSection('tracks');
          store.showKioskHud('Seção: Músicas', 'Digite *código para tocar ou enfileirar', 'info', 2500);
          return;
        }

        // 1l. Buffer vazio e sem playlist -> Abre a tela dedicada com informações da escolha!
        bufferRef.current = '';
        if (store.activeSection === 'top15') {
          store.openBrowser('top15');
          return;
        }
        if (store.activeSection === 'tracks') {
          store.openBrowser('tracks');
          return;
        }
        if (store.activeSection === 'artists') {
          store.openBrowser(store.selectedCategory?.id ?? null, store.selectedArtist ? store.selectedArtist.id : null);
          return;
        }
        if (store.activeSection === 'categories') {
          store.openBrowser(store.selectedCategory ? store.selectedCategory.id : 'category');
          return;
        }

        store.setPixModalOpen(true);
        audioEngine.playCashRegisterSound();
        store.showKioskHud('Inserir Créditos via PIX', 'Tecla [ENTER] pressionada', 'info', 2500);
        return;
      }

      // 2. '+' e '-': Paginam a lista da seção ativa; volume no Now Playing / Geral
      const paginate = (delta: number) => {
        const sec = store.activeSection;
        const st = useJukeboxStore.getState();
        if (st.browserOpen || sec === 'tracks') {
          const total = Math.max(1, Math.ceil(currentTrackList(st).length / PAGE_SIZE));
          const next = Math.min(total - 1, Math.max(0, st.trackPage + delta));
          st.setTrackPage(next);
          st.setActiveSection('tracks');
          st.showKioskHud(`Página de Músicas ${next + 1}/${total}`, '[+] / [-] para navegar', 'info', 1500);
        } else if (sec === 'artists') {
          const total = Math.max(1, Math.ceil(currentArtistList(st).length / PAGE_SIZE));
          const next = Math.min(total - 1, Math.max(0, st.artistPage + delta));
          st.setArtistPage(next);
          st.showKioskHud(`Página de Artistas ${next + 1}/${total}`, '[+] / [-] para navegar', 'info', 1500);
        } else {
          if (delta > 0) st.increaseVolume();
          else st.decreaseVolume();
        }
      };

      if (key === '+' || e.code === 'NumpadAdd') {
        e.preventDefault();
        paginate(1);
        return;
      }
      if (key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        if (store.selectedArtist) {
          store.setSelectedArtist(null);
          store.showKioskHud('Filtro de Artista Removido', '[-] / Esc', 'info', 1500);
          return;
        }
        if (store.selectedCategory) {
          store.setSelectedCategory(null);
          store.showKioskHud('Filtro de Categoria Removido', '[-] / Esc', 'info', 1500);
          return;
        }
        paginate(-1);
        return;
      }

      // 3. PREFIXO DE CATEGORIA: '/'
      if (key === '/' || e.code === 'NumpadDivide') {
        e.preventDefault();
        bufferRef.current = '/';
        store.setActiveSection('categories');
        store.showKioskHud(
          '[/] Escolha a Categoria',
          'Digite o número da categoria (ex: / 1 ou / 10) e aperte ENTER',
          'info',
          4000
        );
        resetBufferAfterDelay(4500);
        return;
      }

      // 4. PREFIXO DE MÚSICA DIRETA: '*'
      if (key === '*' || e.code === 'NumpadMultiply') {
        e.preventDefault();
        bufferRef.current = '*';
        store.setActiveSection('tracks');
        store.showKioskHud(
          '[*] Digite o Código da Música',
          'Exemplo: *01, *15 para tocar ou montar playlist',
          'info',
          4000
        );
        resetBufferAfterDelay(4500);
        return;
      }

      // 5. DÍGITOS: '0' a '9'
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        const current = bufferRef.current;

        // Modo A: Buffer de Categoria [/] (ex: / 1, / 10)
        if (current.startsWith('/')) {
          const next = current + key;
          bufferRef.current = next;
          const catQuery = next.substring(1);
          store.showKioskHud(`Categoria: [ / ${catQuery} ]`, 'Aperte ENTER para abrir ou continue digitando', 'info', 3000);
          resetBufferAfterDelay(3500);
          return;
        }

        // Modo B: Buffer de Código Direto [*] (ex: *01, *15, *0000, *12345)
        if (current.startsWith('*')) {
          const next = current + key;
          bufferRef.current = next;
          const codeDigits = next.substring(1);

          if (codeDigits === '0000') {
            store.showKioskHud('Código: [*0000]', 'Aperte ENTER para sair da conta', 'warning', 4000);
            resetBufferAfterDelay(4000);
            return;
          }
          if (codeDigits === '9999') {
            store.showKioskHud('Código: [*9999]', 'Aperte ENTER para Painel Admin', 'info', 4000);
            resetBufferAfterDelay(4000);
            return;
          }
          if (codeDigits === '8888') {
            store.showKioskHud('Código: [*8888]', 'Aperte ENTER para Telão TV 2', 'info', 4000);
            resetBufferAfterDelay(4000);
            return;
          }
          if (codeDigits === '7777') {
            store.showKioskHud('Código: [*7777]', 'Aperte ENTER para mudar tema', 'info', 4000);
            resetBufferAfterDelay(4000);
            return;
          }
          if (codeDigits === '6666' || codeDigits === '0') {
            store.showKioskHud('Código: [*0]', 'Aperte ENTER para pular música', 'info', 4000);
            resetBufferAfterDelay(4000);
            return;
          }
          if (codeDigits.length === 5 && /^\d+$/.test(codeDigits)) {
            store.showKioskHud(`Código Cliente: [*${codeDigits}]`, 'Aperte ENTER para carregar créditos', 'info', 4000);
            resetBufferAfterDelay(4000);
            return;
          }

          store.showKioskHud(`Código: [* ${codeDigits}]`, 'Aperte ENTER para confirmar ou aguarde', 'info', 3000);

          if (codeDigits.length >= 2 && !codeDigits.startsWith('000') && codeDigits.length <= 3) {
            setTimeout(() => {
              if (bufferRef.current === next) {
                executeTrackByCode(codeDigits);
                bufferRef.current = '';
              }
            }, 650);
          } else {
            resetBufferAfterDelay(3500);
          }
          return;
        }

        // Modo C: Buffer numérico já em andamento (ex: 0000, 9999, ou PIN de 5 dígitos)
        if (current.length > 0 && /^\d+$/.test(current)) {
          const next = current + key;
          bufferRef.current = next;
          if (next === '0000') {
            store.showKioskHud('Código: [0000]', 'Aperte ENTER para sair da conta', 'warning', 4000);
          } else if (next === '00') {
            store.showKioskHud('Código: [00]', 'Aperte ENTER para pular música ou continue para 0000', 'info', 3500);
          } else if (next === '9999') {
            store.showKioskHud('Código: [9999]', 'Aperte ENTER para Painel Admin', 'info', 4000);
          } else if (next === '8888') {
            store.showKioskHud('Código: [8888]', 'Aperte ENTER para Telão TV 2', 'info', 4000);
          } else if (next === '7777') {
            store.showKioskHud('Código: [7777]', 'Aperte ENTER para mudar tema', 'info', 4000);
          } else if (next === '6666') {
            store.showKioskHud('Código: [6666]', 'Aperte ENTER para pular música', 'info', 4000);
          } else if (next.length === 5) {
            store.showKioskHud(`Código Cliente: [${next}]`, 'Aperte ENTER para carregar créditos', 'info', 4000);
          } else {
            store.showKioskHud(`Código: [${next}]`, 'Continue digitando ou aperte ENTER', 'info', 3000);
          }
          resetBufferAfterDelay(4000);
          return;
        }

        // Tecla '0': se usuário estiver logado ou já pressionou, inicia sequência de comando
        if (key === '0') {
          if (store.currentUser || current === '0') {
            bufferRef.current = current + '0';
            store.showKioskHud(`Código: [${bufferRef.current}]`, 'Digite 0000 e ENTER para sair | [00] para pular', 'info', 3000);
            resetBufferAfterDelay(3500);
            return;
          }
          if (store.isPlaying) {
            store.pauseTrack();
            store.showKioskHud('Pausado', '[0] Play / Pause', 'info', 1800);
          } else {
            store.resumeTrack();
            store.showKioskHud('Tocando', '[0] Play / Pause', 'success', 1800);
          }
          return;
        }

        // Se buffer vazio: Modo Cursor nos números!
        // 8 (cima), 2 (baixo), 4 (esquerda), 6 (direita), 5 (confirma)
        // 1 (desativar telão), 3 (ativar telão), 7 (página anterior), 9 (próxima página)
        if (!current) {
          if (key === '8') {
            e.preventDefault();
            const sections: ('categories' | 'artists' | 'tracks' | 'top15')[] = ['categories', 'artists', 'tracks', 'top15'];
            const idx = sections.indexOf(store.activeSection);
            const nextSec = sections[(idx - 1 + sections.length) % sections.length];
            store.setActiveSection(nextSec);
            store.showKioskHud(`Seção: [ ${nextSec.toUpperCase()} ]`, '[8 ▲] Cima | [Enter/5] Confirma', 'info', 1800);
            return;
          }
          if (key === '2') {
            e.preventDefault();
            const sections: ('categories' | 'artists' | 'tracks' | 'top15')[] = ['categories', 'artists', 'tracks', 'top15'];
            const idx = sections.indexOf(store.activeSection);
            const nextSec = sections[(idx + 1) % sections.length];
            store.setActiveSection(nextSec);
            store.showKioskHud(`Seção: [ ${nextSec.toUpperCase()} ]`, '[2 ▼] Baixo | [Enter/5] Confirma', 'info', 1800);
            return;
          }
          if (key === '4') {
            e.preventDefault();
            paginate(-1);
            return;
          }
          if (key === '6') {
            e.preventDefault();
            paginate(1);
            return;
          }
          if (key === '1') {
            e.preventDefault();
            store.setSecondaryScreenOpen(false);
            store.showKioskHud('Telão do Bar (TV 2)', 'Telão Desativado [Tecla 1]', 'info', 2000);
            return;
          }
          if (key === '3') {
            e.preventDefault();
            store.setSecondaryScreenOpen(true);
            store.showKioskHud('Telão do Bar (TV 2)', 'Telão Ativado [Tecla 3]', 'success', 2000);
            return;
          }
          if (key === '7') {
            e.preventDefault();
            paginate(-1);
            store.showKioskHud('Página Anterior [7]', 'Navegação por cursor', 'info', 1500);
            return;
          }
          if (key === '9') {
            e.preventDefault();
            paginate(1);
            store.showKioskHud('Próxima Página [9]', 'Navegação por cursor', 'info', 1500);
            return;
          }
          if (key === '5') {
            e.preventDefault();
            if (store.userPlaylist.length > 0) {
              const totalCost = store.userPlaylist.reduce((acc, t) => acc + t.cost, 0);
              const availableCredits = store.currentUser ? store.currentUser.credits : store.credits;
              if (availableCredits >= totalCost) {
                store.commitUserPlaylist();
              } else {
                store.setPixModalOpen(true);
                audioEngine.playCashRegisterSound();
                store.showKioskHud(
                  `Recarregar Pix: Playlist custa ${totalCost} cr`,
                  `Você possui ${availableCredits} crédito(s). Adicione créditos para tocar`,
                  'warning',
                  3500
                );
              }
              return;
            }
            if (store.activeSection === 'top15') store.openBrowser('top15');
            else if (store.activeSection === 'tracks') store.openBrowser('tracks');
            else if (store.activeSection === 'artists') store.openBrowser(store.selectedCategory?.id ?? null, store.selectedArtist?.id);
            else store.openBrowser('category');
            store.showKioskHud('Confirmado [5]', 'Seção selecionada', 'success', 1800);
            return;
          }
        }

        const digit = parseInt(key, 10);

        // Contexto 1: tela dedicada de músicas aberta -> 1-9 seleciona a faixa da página
        if (store.browserOpen) {
          const list = currentTrackList(store);
          const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
          const page = Math.min(store.trackPage, total - 1);
          const track = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)[digit - 1];
          if (!track) {
            store.showKioskHud(`Sem faixa no número [${key}]`, `Página ${page + 1}/${total}`, 'warning', 2000);
            return;
          }
          const isInPlaylist = store.userPlaylist.some((t) => t.id === track.id);
          if (isInPlaylist) {
            store.removeFromUserPlaylist(track.id);
            store.showKioskHud(`Removida: ${track.title}`, `[${key}] fora da playlist`, 'info', 2000);
          } else {
            store.addToUserPlaylist(track);
            store.showKioskHud(
              `[${key}] Selecionada: ${track.title}`,
              `${track.artist} • *${track.code} • ${track.cost} créd`,
              'success',
              2500
            );
          }
          return;
        }

        // Contexto 2: seção de artistas -> 1-9 abre a página dedicada do artista
        if (store.activeSection === 'artists') {
          const list = currentArtistList(store);
          const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
          const page = Math.min(store.artistPage, total - 1);
          const chosenArtist = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)[digit - 1];
          if (!chosenArtist) {
            store.showKioskHud(`Sem artista no número [${key}]`, `Página ${page + 1}/${total}`, 'warning', 2000);
            return;
          }
          store.openBrowser(store.selectedCategory?.id ?? null, chosenArtist.id);
          store.showKioskHud(
            `Cantor(a): ${chosenArtist.name}`,
            `[${key}] Artista Selecionado(a) | Mostrando músicas`,
            'success',
            2500
          );
          return;
        }

        // Contexto 3: seção de categorias -> escolhe categoria pelo número/código
        if (store.activeSection === 'categories') {
          executeCategoryByCodeOrNumber(key);
          return;
        }

        // Contexto 4: seção de músicas -> 1-9 alterna a faixa da página na playlist
        if (store.activeSection === 'tracks') {
          const list = currentTrackList(store);
          const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
          const page = Math.min(store.trackPage, total - 1);
          const track = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)[digit - 1];
          if (!track) {
            store.showKioskHud(`Sem faixa no número [${key}]`, `Página ${page + 1}/${total}`, 'warning', 2000);
            return;
          }
          const isInPlaylist = store.userPlaylist.some((t) => t.id === track.id);
          if (isInPlaylist) {
            store.removeFromUserPlaylist(track.id);
            store.showKioskHud(`Removida: ${track.title}`, `[${key}] fora da playlist`, 'info', 2000);
          } else {
            store.addToUserPlaylist(track);
            store.showKioskHud(
              `[${key}] Selecionada: ${track.title}`,
              `${track.artist} • *${track.code} • ${track.cost} créd`,
              'success',
              2500
            );
          }
          return;
        }

        // Contexto 5: seção Top 15 -> 1-9 toca a música do ranking correspondente
        if (store.activeSection === 'top15') {
          const topTracks = store.tracks.slice(0, 15);
          const track = topTracks[digit - 1];
          if (track) {
            store.addToQueue(track, 'Cliente (Top 15)');
            store.showKioskHud(
              `Top #${digit}: ${track.title}`,
              `${track.artist} adicionada à fila`,
              'success',
              2500
            );
          }
          return;
        }

        // Fallback: inicia buffer numérico com *
        bufferRef.current = '*' + key;
        store.setActiveSection('tracks');
        store.showKioskHud(`Código: [* ${key}]`, 'Digite o próximo número ou aperte ENTER', 'info', 3000);
        resetBufferAfterDelay(3000);
      }

      // 6. BACKSPACE / ESCAPE: Limpa buffer ou retorna
      if (key === 'Backspace' || key === 'Escape') {
        e.preventDefault();
        if (bufferRef.current.length > 0) {
          bufferRef.current = '';
          store.showKioskHud('Digitação cancelada', '', 'info', 1200);
        } else if (store.selectedArtist) {
          store.setSelectedArtist(null);
          store.showKioskHud('Voltar para todos os artistas', '', 'info', 1500);
        } else if (store.selectedCategory) {
          store.setSelectedCategory(null);
          store.showKioskHud('Voltar para todas as categorias', '', 'info', 1500);
        } else if (store.userPlaylist.length > 0) {
          store.clearUserPlaylist();
          store.showKioskHud('Playlist limpa', '', 'info', 1500);
        } else if (store.isAccessibilityKeypadOpen) {
          store.setAccessibilityKeypadOpen(false);
        } else if (store.isSecondaryScreenOpen) {
          store.setSecondaryScreenOpen(false);
        } else if (store.isAdminModalOpen) {
          store.setAdminModalOpen(false);
        }
      }
    };

    // Helper: Seleciona categoria por código ou número
    const executeCategoryByCodeOrNumber = (query: string) => {
      const store = useJukeboxStore.getState();
      const num = parseInt(query, 10);
      const categories = store.categories;
      const found = categories.find((c) => c.code === query || c.code === String(num));

      if (found) {
        store.openBrowser(found.id);
        store.showKioskHud(
          `Categoria: ${found.name}`,
          `[ / ${query} ] Aberta! Use [1-9] para selecionar e [Enter] para confirmar`,
          'success',
          3000
        );
      } else {
        const idx = num - 1;
        if (idx >= 0 && idx < categories.length) {
          const cat = categories[idx];
          store.openBrowser(cat.id);
          store.showKioskHud(
            `Categoria: ${cat.name}`,
            `[ / ${num} ] Aberta! Use [1-9] para selecionar`,
            'success',
            3000
          );
        } else {
          store.showKioskHud(`Categoria [ / ${query} ] não encontrada`, 'Escolha de 1 a 10', 'warning', 2500);
        }
      }
    };

    // Helper: Toca ou enfileira música por código direto
    const executeTrackByCode = (codeStr: string) => {
      const store = useJukeboxStore.getState();
      const padded = codeStr.padStart(2, '0');
      const track = store.tracks.find(
        (t) => t.code.toLowerCase() === codeStr.toLowerCase() || t.code === padded
      );

      if (track) {
        // Se o usuário já tiver faixas na playlist pendente, adiciona à playlist
        if (store.userPlaylist.length > 0) {
          store.addToUserPlaylist(track);
          return;
        }

        const success = store.addToQueue(track, 'Cliente (Numpad)');
        if (success) {
          store.showKioskHud(
            `✓ Adicionada: ${track.title}`,
            `${track.artist} [Código *${track.code}]`,
            'success',
            3200
          );
        } else {
          // Créditos insuficientes!
          store.showKioskHud(
            `Sem créditos para #${track.code}!`,
            'Pressione ENTER para inserir créditos via PIX',
            'warning',
            3500
          );
        }
      } else {
        store.showKioskHud(`Música [#${codeStr}] não encontrada`, 'Verifique o código na tabela', 'error', 3000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
      clearPendingInput();
    };
  }, []);
};
