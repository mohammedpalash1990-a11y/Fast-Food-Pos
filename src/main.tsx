import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CustomerMenu from './menu/CustomerMenu';
import './index.css';

// `/menu` is the customer-facing QR menu. Hosts that rewrite unknown paths to
// index.html (the usual static-site setup) still land on the menu, while the
// dedicated menu.html entry works on hosts that serve files verbatim.
const path = window.location.pathname.replace(/\/+$/, '');
const isPublicMenu = path === '/menu' || path === '/menu.html';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isPublicMenu ? <CustomerMenu /> : <App />}
  </React.StrictMode>
);
