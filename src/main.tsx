import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { tauriBridge } from './services/tauriBridge';

window.addEventListener('error', (e) =>
  tauriBridge.log(`window.error: ${e.message} @${e.filename}:${e.lineno}:${e.colno}`)
);
window.addEventListener('unhandledrejection', (e) =>
  tauriBridge.log(`unhandledrejection: ${(e.reason && (e.reason.message || e.reason)) ?? 'desconhecido'}`)
);
const _consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  _consoleError(...args);
  tauriBridge.log(`console.error: ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')}`);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
