import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { BrowserRouter, Routes, Route } from "react-router"
import { LoginPage, AuthCallback } from './pages';
import { LoginModal, SubscriptionModal } from './components/ui';
import { AuthProvider } from './contexts/AuthContext';

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth" element={<AuthCallback />} />
        </Routes>
        <LoginModal />
        <SubscriptionModal />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
