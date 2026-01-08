import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from "react-router"

import { AuthProvider } from './contexts/AuthContext';
import { AuthCallback } from '@/pages';
import { LoginModal, SubscriptionModal, ErrorBoundary } from './components/ui';

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/auth/*" element={<AuthCallback />} />
          </Routes>
          <LoginModal />
          <SubscriptionModal />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
