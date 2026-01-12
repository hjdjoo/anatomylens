import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

import { ErrorBoundary } from './components/ui';
import { AuthProvider } from './contexts/AuthContext';

// import App from './App';
import './index.css';

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!

if (!rootElement.innerHTML) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode >,
  );

}
