import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { AuthProvider } from '@/contexts/AuthContext';
import { LoginModal, SubscriptionModal, ToastContainer } from '@/components/ui';

const RootLayout = () => (
  <>
    <AuthProvider>
      <Outlet />
      <TanStackRouterDevtools />
      <LoginModal />
      <SubscriptionModal />
      <ToastContainer />
    </AuthProvider>
  </>
)

export const Route = createRootRoute({ component: RootLayout })