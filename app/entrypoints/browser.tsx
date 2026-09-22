import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../frontend/shell/App';
import '../frontend/shell/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
