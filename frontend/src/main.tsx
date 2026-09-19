import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Initialize appearance preferences (Neon Glow Effects & Glassmorphism)
const savedGlow = localStorage.getItem('rakshak_glow_effects');
if (savedGlow === 'false') {
  document.documentElement.setAttribute('data-glow', 'false');
} else {
  document.documentElement.setAttribute('data-glow', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
