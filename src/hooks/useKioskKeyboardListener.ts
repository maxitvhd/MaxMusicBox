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

  // Clear keyboard buffer with timeout
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
      if (store.isPixModalOpen) {
        clearPendingInput();
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) store.setPixModalOpen(false);
        }
        return;
      }
      if (store.isUserLoginOpen) {
        // O modal de login captura as teclas (senha via teclado físico).
        clearPendingInput();
        return;
      }
      if (e.key === 'Escape' && e.repeat) return;
      // Don't intercept if user is typing in form inputs (like admin PIN input or search inputs)
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

      // 0. COMMA / DOT (,) or (.): Toggle Remote Navigation Mode
      // "se apertamos o , podemos navegar por secoes usando as teclas nuericas como um controle remoto navegar pelos 4862 clicando enter para escolher a secao e , novamente volta a escolher numeros"
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
          `Seção Ativa: [ ${nextSec.toUpperCase()} ]`,
          'Teclas [1-9] selecionam | [+] / [-] paginam | [0] play/pause | [,] alterna seção',
          'info',
          3500
        );
        return;
      }

      // 1. ENTER / NUMPAD ENTER
      if (key === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        const currentBuffer = bufferRef.current.trim();

        // 1a. If there is a pending user playlist selected
        if (store.userPlaylist.length > 0 && !currentBuffer) {
          const totalCost = store.userPlaylist.reduce((acc, t) => acc + t.cost, 0);
          if (store.credits >= totalCost) {
            store.commitUserPlaylist();
            return;
          } else {
            store.setPixModalOpen(true);
            audioEngine.playCashRegisterSound();
            store.showKioskHud(
              `Recarregar Pix: Playlist custa ${totalCost} cr`,
              `Você possui ${store.credits} crédito(s). Adicione créditos para tocar`,
              'warning',
              3500
            );
            return;
          }
        }

        // 1b. Direct track execution via *
        if (currentBuffer.startsWith('*') && currentBuffer.length > 1) {
          const code = currentBuffer.substring(1);
          executeTrackByCode(code);
          bufferRef.current = '';
          return;
        }

        // 1c. Category selection via /
        if (currentBuffer.startsWith('/') && currentBuffer.length > 1) {
          const catStr = currentBuffer.substring(1);
          executeCategoryByCodeOrNumber(catStr);
          bufferRef.current = '';
          return;
        }

        // 1d. If in remote section navigation
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

        // 1e. Empty buffer and no playlist -> Open Pix modal directly!
        // "a abertura do pix e o enter sem clicar em nada ou sem credito"
        bufferRef.current = '';
        store.setPixModalOpen(true);
        audioEngine.playCashRegisterSound();
        store.showKioskHud('Inserir Créditos via PIX', 'Tecla [ENTER] pressionada', 'info', 2500);
        return;
      }

      // 2. '+' e '-': contextuais. Paginam a lista da seção ativa; volume no Top 15 / Now Playing.
      const paginate = (delta: number) => {
        const sec = useJukeboxStore.getState().activeSection;
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
        paginate(-1);
        return;
      }

      // 3. CATEGORY PREFIX: '/'
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

      // 4. DIRECT TRACK PREFIX: '*'
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

      // 5. DIGITS: '0' - '9'
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        const current = bufferRef.current;

        // Mode A: In Category selection buffer [/] (supports multi-digit like / 10)
        if (current.startsWith('/')) {
          const next = current + key;
          bufferRef.current = next;
          const catQuery = next.substring(1);
          store.showKioskHud(`Categoria: [ / ${catQuery} ]`, 'Aperte ENTER para abrir ou continue digitando', 'info', 3000);
          resetBufferAfterDelay(3500);
          return;
        }

        // Mode B: In Track code buffer [*] (supports multi-digit like *01, *15)
        if (current.startsWith('*')) {
          const next = current + key;
          bufferRef.current = next;
          const codeDigits = next.substring(1);
          store.showKioskHud(`Código: [* ${codeDigits}]`, 'Aperte ENTER para confirmar ou aguarde', 'info', 3000);

          if (codeDigits.length >= 2) {
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

        // 0 SEMPRE alterna Play/Pause.
        if (key === '0') {
          if (store.isPlaying) {
            store.pauseTrack();
            store.showKioskHud('Pausado', '[0] Play / Pause', 'info', 1800);
          } else {
            store.resumeTrack();
            store.showKioskHud('Tocando', '[0] Play / Pause', 'success', 1800);
          }
          return;
        }

        const digit = parseInt(key, 10);

        // Contexto 1: tela dedicada de músicas aberta -> 1-9 seleciona a faixa da página.
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

        // Contexto 2: seção de artistas -> 1-9 abre a página dedicada do artista.
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

        // Contexto 3: seção de categorias -> escolhe categoria pelo número/código.
        if (store.activeSection === 'categories') {
          executeCategoryByCodeOrNumber(key);
          return;
        }

        // Contexto 4: seção de músicas -> 1-9 alterna a faixa da página na playlist.
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

        // Fallback (Top 15 / Now Playing): digita código direto.
        bufferRef.current = '*' + key;
        store.setActiveSection('tracks');
        store.showKioskHud(`Código: [* ${key}]`, 'Digite o próximo número ou aperte ENTER', 'info', 3000);
        resetBufferAfterDelay(3000);
      }

      // 6. BACKSPACE / ESCAPE: Clear buffer or return
      if (
        key === 'Backspace' ||
        key === 'Escape'
      ) {
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
        }
      }
    };

    // Helper: Select Category by code or number
    const executeCategoryByCodeOrNumber = (query: string) => {
      const store = useJukeboxStore.getState();
      const num = parseInt(query, 10);
      const categories = store.categories;
      const found = categories.find(c => c.code === query || c.code === String(num));

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

    // Helper: Play or Queue Track by direct code
    const executeTrackByCode = (codeStr: string) => {
      const store = useJukeboxStore.getState();
      const padded = codeStr.padStart(2, '0');
      const track = store.tracks.find(
        (t) => t.code.toLowerCase() === codeStr.toLowerCase() || t.code === padded
      );

      if (track) {
        // If user already has tracks in pending playlist, add to playlist instead
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
          // Insufficient credits!
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
