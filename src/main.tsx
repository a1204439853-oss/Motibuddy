import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from 'sonner';
import App from "./App.tsx";
import "./index.css";
import './components/ui/unified.css';
import { connectLocaleWindows } from './i18n/react';

connectLocaleWindows();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        richColors
        className="bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-orange-100"
      />
    </BrowserRouter>
  </StrictMode>
);
