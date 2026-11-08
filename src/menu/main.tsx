import React from 'react';
import ReactDOM from 'react-dom/client';
import PublicMenu from './PublicMenu';
import '../index.css';

ReactDOM.createRoot(document.getElementById('public-menu') as HTMLElement).render(
  <React.StrictMode>
    <PublicMenu />
  </React.StrictMode>
);
