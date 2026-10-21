import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useThemeStore } from './stores/themeStore';

// Initialize theme before rendering to avoid flicker
useThemeStore.getState().initialize();

const root = document.getElementById('root');
if (!root) throw new Error('No root element found');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
