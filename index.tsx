import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // חשוב ביותר: פותר את שגיאת ה-404 של העיצוב!

// --- RUNTIME INTEGRITY CHECK ---
console.log(`%c SYSTEM BOOT | React Version: ${React.version}`, 'background: #000; color: #00ff00; font-weight: bold; padding: 4px;');

if (React.version.startsWith('19')) {
    console.error("FATAL: React 19 Leak Detected. Please refresh to trigger Self-Healing Protocol.");
}

const container = document.getElementById('root');
const loader = document.getElementById('engine-loader');

if (container) {
  const root = createRoot(container);
  
  const removeLoader = () => {
    if (loader) {
      loader.style.transition = 'opacity 0.5s ease';
      loader.style.opacity = '0';
      setTimeout(() => {
        if (loader.parentNode) {
          loader.remove();
        }
      }, 500);
    }
  };

  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // הסרת ה-Loader לאחר טעינה מוצלחת
    setTimeout(removeLoader, 1000);
    Promise.resolve().then(removeLoader);
  } catch (error) {
    console.error("Critical Engine Boot Failure:", error);
    removeLoader();
  }
}
