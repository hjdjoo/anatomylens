import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { BrowserRouter, Routes, Route } from "react-router"
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import { AuthProvider } from './contexts/AuthContext';

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
