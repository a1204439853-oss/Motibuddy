import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WidgetWindow from './pages/WidgetWindow';
import './components/ui/desktop.css';
import NeoMotionProvider from './components/ui/NeoMotionProvider';
import { connectLocaleWindows } from './i18n/react';

connectLocaleWindows();

createRoot(document.getElementById('widget-root')!).render(
  <StrictMode>
    <NeoMotionProvider>
    <WidgetWindow />
    </NeoMotionProvider>
  </StrictMode>
);
