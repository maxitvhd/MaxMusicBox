import { Category, Artist, Track } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'rock',
    code: '1',
    name: 'Rock Clássico & BR',
    iconName: 'Flame',
    coverImage: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80',
    color: '#ef4444',
    description: 'Os maiores hinos da guitarra, do rock nacional ao clássico mundial.'
  },
  {
    id: 'samba',
    code: '2',
    name: 'Samba & Pagode',
    iconName: 'Music2',
    coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    color: '#f59e0b',
    description: 'Roda de samba tradicional, cavaquinho, pandeiro e batuque de primeira.'
  },
  {
    id: 'mpb',
    code: '3',
    name: 'MPB & Bossa',
    iconName: 'Mic2',
    coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    color: '#06b6d4',
    description: 'Poesia, harmonia acústica e os grandes clássicos da música brasileira.'
  },
  {
    id: 'sertanejo',
    code: '4',
    name: 'Sertanejo Raiz',
    iconName: 'Radio',
    coverImage: 'https://images.unsplash.com/photo-1520523839898-50712825e317?w=600&auto=format&fit=crop&q=80',
    color: '#10b981',
    description: 'Modão de viola caipira, clássicos de bar e histórias do sertão.'
  },
  {
    id: 'flashback',
    code: '5',
    name: 'Flashback 80s/90s',
    iconName: 'Disc',
    coverImage: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    color: '#ec4899',
    description: 'Sintetizadores, disco fever e as músicas que marcaram época nas pistas.'
  },
  {
    id: 'forro',
    code: '6',
    name: 'Forró Pé de Serra',
    iconName: 'Headphones',
    coverImage: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
    color: '#8b5cf6',
    description: 'Sanfona afiada, triângulo e zabumba no ritmo autêntico do nordeste.'
  },
  {
    id: 'pop',
    code: '7',
    name: 'Pop Nacional & Global',
    iconName: 'Sparkles',
    coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    color: '#3b82f6',
    description: 'Hits das paradas de sucesso e melodias contagiantes.'
  },
  {
    id: 'reggae',
    code: '8',
    name: 'Reggae & Roots',
    iconName: 'Sun',
    coverImage: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
    color: '#10b981',
    description: 'Boas vibrações, baixo marcante e mensagens de paz e união.'
  },
  {
    id: 'axe',
    code: '9',
    name: 'Axé & Carnaval',
    iconName: 'PartyPopper',
    coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    color: '#f97316',
    description: 'Trio elétrico de Salvador, percussão envolvente e energia pura.'
  },
  {
    id: 'bar-classicos',
    code: '10',
    name: 'Músicas de Bar & Boteco',
    iconName: 'Wine',
    coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    color: '#d97706',
    description: 'Grandes clássicos das noites boêmias de bar e jukebox.'
  }
];

export const INITIAL_ARTISTS: Artist[] = [
  // Rock
  {
    id: 'raul-seixas',
    name: 'Raul Seixas',
    categoryId: 'rock',
    avatar: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=80',
    bio: 'O Maluco Beleza e pai do rock brasileiro.'
  },
  {
    id: 'legiao-urbana',
    name: 'Legião Urbana',
    categoryId: 'rock',
    avatar: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&auto=format&fit=crop&q=80',
    bio: 'Poesia pura e o hino de gerações sob a voz de Renato Russo.'
  },
  {
    id: 'queen',
    name: 'Queen',
    categoryId: 'rock',
    avatar: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&auto=format&fit=crop&q=80',
    bio: 'Freddie Mercury e a grandiosidade do rock de arena britânico.'
  },
  // Samba
  {
    id: 'zeca-pagodinho',
    name: 'Zeca Pagodinho',
    categoryId: 'samba',
    avatar: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=300&auto=format&fit=crop&q=80',
    bio: 'O mestre de Xerém, simpatia e clássicos do pagode autêntico.'
  },
  {
    id: 'fundo-de-quintal',
    name: 'Fundo de Quintal',
    categoryId: 'samba',
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    bio: 'Os inventores do repique de mão e pioneiros do pagode no Cacique de Ramos.'
  },
  // MPB
  {
    id: 'tim-maia',
    name: 'Tim Maia',
    categoryId: 'mpb',
    avatar: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300&auto=format&fit=crop&q=80',
    bio: 'O síndico do Brasil, rei do soul e da alegria contagiante.'
  },
  {
    id: 'elis-regina',
    name: 'Elis Regina',
    categoryId: 'mpb',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    bio: 'A maior intérprete da canção brasileira, o Furacão da MPB.'
  },
  // Sertanejo
  {
    id: 'chitaozinho-xororo',
    name: 'Chitãozinho & Xororó',
    categoryId: 'sertanejo',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    bio: 'A dupla que levou o sertanejo dos botecos para as grandes arenas.'
  },
  {
    id: 'tiao-carreiro',
    name: 'Tião Carreiro & Pardinho',
    categoryId: 'sertanejo',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    bio: 'Os reis do pagode caipira e do ponteado de viola imortal.'
  },
  // Flashback
  {
    id: 'michael-jackson',
    name: 'Michael Jackson',
    categoryId: 'flashback',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    bio: 'O Rei do Pop, batidas marcantes e passos que desafiaram a gravidade.'
  },
  {
    id: 'a-ha',
    name: 'A-ha',
    categoryId: 'flashback',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
    bio: 'Os pioneiros do synth-pop norueguês nos anos 80.'
  },
  // Forró
  {
    id: 'luiz-gonzaga',
    name: 'Luiz Gonzaga',
    categoryId: 'forro',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
    bio: 'O eterno Rei do Baião, voz e sanfona de todo um povo.'
  },
  // Pop, Reggae, Axé, Bar & Boteco (Categoria 10)
  {
    id: 'reginaldo-rossi',
    name: 'Reginaldo Rossi',
    categoryId: 'bar-classicos',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    bio: 'O Rei do Brega, voz marcante das noites de boteco e cabaré.'
  },
  {
    id: 'amado-batista',
    name: 'Amado Batista',
    categoryId: 'bar-classicos',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    bio: 'Mais de 44 anos cantando o amor e a paixão brasileira.'
  },
  {
    id: 'alcione',
    name: 'Alcione',
    categoryId: 'bar-classicos',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    bio: 'A Marrom, potência vocal e grandes sucessos da boemia.'
  }
];

export const INITIAL_TRACKS: Track[] = [
  // Rock Clássico (01 a 06)
  {
    id: 'trk-01',
    code: '01',
    title: 'Metamorfose Ambulante',
    artist: 'Raul Seixas',
    artistId: 'raul-seixas',
    category: 'rock',
    duration: 232,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80',
    genre: 'rock',
    bpm: 118
  },
  {
    id: 'trk-02',
    code: '02',
    title: 'Maluco Beleza',
    artist: 'Raul Seixas',
    artistId: 'raul-seixas',
    category: 'rock',
    duration: 205,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    genre: 'rock',
    bpm: 122
  },
  {
    id: 'trk-03',
    code: '03',
    title: 'Tempo Perdido',
    artist: 'Legião Urbana',
    artistId: 'legiao-urbana',
    category: 'rock',
    duration: 302,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    genre: 'rock',
    bpm: 124
  },
  {
    id: 'trk-04',
    code: '04',
    title: 'Pais e Filhos',
    artist: 'Legião Urbana',
    artistId: 'legiao-urbana',
    category: 'rock',
    duration: 310,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    genre: 'rock',
    bpm: 104
  },
  {
    id: 'trk-05',
    code: '05',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    artistId: 'queen',
    category: 'rock',
    duration: 355,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
    genre: 'rock',
    bpm: 140
  },
  {
    id: 'trk-06',
    code: '06',
    title: 'Don\'t Stop Me Now',
    artist: 'Queen',
    artistId: 'queen',
    category: 'rock',
    duration: 210,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    genre: 'rock',
    bpm: 156
  },

  // Samba & Pagode (10 a 15)
  {
    id: 'trk-10',
    code: '10',
    title: 'Deixa a Vida Me Levar',
    artist: 'Zeca Pagodinho',
    artistId: 'zeca-pagodinho',
    category: 'samba',
    duration: 275,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    genre: 'samba',
    bpm: 98
  },
  {
    id: 'trk-11',
    code: '11',
    title: 'Coração em Desalinho',
    artist: 'Zeca Pagodinho',
    artistId: 'zeca-pagodinho',
    category: 'samba',
    duration: 215,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=600&auto=format&fit=crop&q=80',
    genre: 'samba',
    bpm: 102
  },
  {
    id: 'trk-12',
    code: '12',
    title: 'O Show Tem Que Continuar',
    artist: 'Fundo de Quintal',
    artistId: 'fundo-de-quintal',
    category: 'samba',
    duration: 242,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
    genre: 'samba',
    bpm: 95
  },
  {
    id: 'trk-13',
    code: '13',
    title: 'A Batucada dos Nossos Tantãs',
    artist: 'Fundo de Quintal',
    artistId: 'fundo-de-quintal',
    category: 'samba',
    duration: 198,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    genre: 'samba',
    bpm: 106
  },

  // MPB & Bossa (20 a 24)
  {
    id: 'trk-20',
    code: '20',
    title: 'Não Quero Dinheiro (Só Quero Amar)',
    artist: 'Tim Maia',
    artistId: 'tim-maia',
    category: 'mpb',
    duration: 168,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&auto=format&fit=crop&q=80',
    genre: 'mpb',
    bpm: 128
  },
  {
    id: 'trk-21',
    code: '21',
    title: 'Descobridor dos Sete Mares',
    artist: 'Tim Maia',
    artistId: 'tim-maia',
    category: 'mpb',
    duration: 260,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    genre: 'mpb',
    bpm: 120
  },
  {
    id: 'trk-22',
    code: '22',
    title: 'Como Nossos Pais',
    artist: 'Elis Regina',
    artistId: 'elis-regina',
    category: 'mpb',
    duration: 278,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    genre: 'mpb',
    bpm: 90
  },

  // Sertanejo & Modão (30 a 33)
  {
    id: 'trk-30',
    code: '30',
    title: 'Evidências',
    artist: 'Chitãozinho & Xororó',
    artistId: 'chitaozinho-xororo',
    category: 'sertanejo',
    duration: 295,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1520523839898-50712825e317?w=600&auto=format&fit=crop&q=80',
    genre: 'sertanejo',
    bpm: 94
  },
  {
    id: 'trk-31',
    code: '31',
    title: 'Fio de Cabelo',
    artist: 'Chitãozinho & Xororó',
    artistId: 'chitaozinho-xororo',
    category: 'sertanejo',
    duration: 172,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    genre: 'sertanejo',
    bpm: 112
  },
  {
    id: 'trk-32',
    code: '32',
    title: 'O Mineiro e o Italiano',
    artist: 'Tião Carreiro & Pardinho',
    artistId: 'tiao-carreiro',
    category: 'sertanejo',
    duration: 202,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    genre: 'sertanejo',
    bpm: 110
  },

  // Flashback 80s/90s (40 a 43)
  {
    id: 'trk-40',
    code: '40',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    artistId: 'michael-jackson',
    category: 'flashback',
    duration: 294,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    genre: 'flashback',
    bpm: 117
  },
  {
    id: 'trk-41',
    code: '41',
    title: 'Beat It',
    artist: 'Michael Jackson',
    artistId: 'michael-jackson',
    category: 'flashback',
    duration: 258,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
    genre: 'flashback',
    bpm: 138
  },
  {
    id: 'trk-42',
    code: '42',
    title: 'Take On Me',
    artist: 'A-ha',
    artistId: 'a-ha',
    category: 'flashback',
    duration: 226,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&auto=format&fit=crop&q=80',
    genre: 'flashback',
    bpm: 169
  },

  // Forró (50 a 52)
  {
    id: 'trk-50',
    code: '50',
    title: 'Asa Branca',
    artist: 'Luiz Gonzaga',
    artistId: 'luiz-gonzaga',
    category: 'forro',
    duration: 195,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
    genre: 'forro',
    bpm: 116
  },
  {
    id: 'trk-51',
    code: '51',
    title: 'Pagode Russo',
    artist: 'Luiz Gonzaga',
    artistId: 'luiz-gonzaga',
    category: 'forro',
    duration: 170,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&auto=format&fit=crop&q=80',
    genre: 'forro',
    bpm: 130
  },
  // Músicas de Bar & Boteco (Categoria 10)
  {
    id: 'trk-60',
    code: '60',
    title: 'Garçom',
    artist: 'Reginaldo Rossi',
    artistId: 'reginaldo-rossi',
    category: 'bar-classicos',
    duration: 238,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    genre: 'brega',
    bpm: 108
  },
  {
    id: 'trk-61',
    code: '61',
    title: 'A Raposa e as Uvas',
    artist: 'Reginaldo Rossi',
    artistId: 'reginaldo-rossi',
    category: 'bar-classicos',
    duration: 215,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    genre: 'brega',
    bpm: 114
  },
  {
    id: 'trk-62',
    code: '62',
    title: 'Secretária (Assumida)',
    artist: 'Amado Batista',
    artistId: 'amado-batista',
    category: 'bar-classicos',
    duration: 198,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    genre: 'brega',
    bpm: 112
  },
  {
    id: 'trk-63',
    code: '63',
    title: 'Você Me Vira a Cabeça',
    artist: 'Alcione',
    artistId: 'alcione',
    category: 'bar-classicos',
    duration: 255,
    cost: 1,
    albumArt: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    genre: 'samba-cancao',
    bpm: 96
  }
];
