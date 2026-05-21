import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Block zoom gestures the game isn't meant to expose: ctrl/⌘+scroll on
// desktop, Safari's pinch gesture, and iOS double-tap zoom. The viewport
// meta in index.html handles the standard pinch-zoom; these listeners
// cover the gaps. Browser-level zoom shortcuts (ctrl/⌘ +/-) intentionally
// stay enabled — those are accessibility, not gameplay.
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });
window.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('gesturechange', (e) => e.preventDefault());
window.addEventListener('gestureend', (e) => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
