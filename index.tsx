
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// ثبت Service Worker برای مدیریت اعلان‌ها (مرحله ۱ زیرساخت)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('BaharTime SW registered: ', registration.scope);
      })
      .catch(error => {
        console.log('BaharTime SW registration failed: ', error);
      });
  });
}
