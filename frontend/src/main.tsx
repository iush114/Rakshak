// Restore user preference for Neon Glow Effects on application startup
const initialGlow = localStorage.getItem('rakshak_glow_effects') !== 'false';
document.documentElement.setAttribute('data-glow', initialGlow ? 'true' : 'false');
document.documentElement.setAttribute('data-neon', initialGlow ? 'true' : 'false');

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
