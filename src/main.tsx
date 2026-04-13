import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handling for unhandled rejections (like WebSocket issues)
window.addEventListener('unhandledrejection', (event) => {
  // Ignore benign Vite HMR errors
  if (event.reason?.message?.includes('WebSocket') || event.reason?.includes?.('WebSocket')) {
    event.preventDefault();
    return;
  }
  console.error('Unhandled Rejection:', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
