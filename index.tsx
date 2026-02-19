import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // מייבא את ה-CSS כדי ש-Vite יכלול אותו ב-Build

// --- בדיקת תקינות המערכת בזמן אמת ---
console.log(
  `%c SYSTEM BOOT | React Version: ${React.version}`, 
  'background: #000; color: #00ff00; font-weight: bold; padding: 4px;'
);

// הגנה מפני גרסאות לא תואמות
if (React.version.startsWith('19')) {
    console.error("FATAL: React 19 Leak Detected. Please refresh to trigger Self-Healing Protocol.");
}

const container = document.getElementById('root');
const loader = document.getElementById('engine-loader');

if (container) {
  const root = createRoot(container);
  
  // פונקציה להסרת ה-Loader בצורה חלקה
  const removeLoader = () => {
    if (loader) {
      loader.style.transition = 'opacity 0.8s ease';
      loader.style.opacity = '0';
      setTimeout(() => {
        if (loader.parentNode) {
          loader.remove();
        }
      }, 800);
    }
  };

  try {
    // טעינת האפליקציה
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // הסרת ה-Loader לאחר שהקומפוננטות עלו
    // אנחנו משתמשים בכמה שיטות כדי לוודא שזה קורה
    Promise.resolve().then(() => {
        setTimeout(removeLoader, 1500);
    });

  } catch (error) {
    console.error("Critical Engine Boot Failure:", error);
    // במקרה של שגיאה קריטית, נסיר את הלואודר כדי לראות מה קרה
    if (loader) {
        const textElement = document.getElementById('loader-text');
        if (textElement) textElement.innerText = "BOOT ERROR - Check Console";
        textElement!.style.color = "red";
    }
  }
}
