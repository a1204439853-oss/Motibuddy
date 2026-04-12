import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WidgetWindow from './pages/WidgetWindow';
import './index.css';

createRoot(document.getElementById('widget-root')!).render(
  <StrictMode>
    <WidgetWindow />
  </StrictMode>
);
