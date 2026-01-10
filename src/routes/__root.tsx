import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { ErrorBoundary } from '@/components/ui';
import { LoginModal, SubscriptionModal, ToastContainer } from '@/components/ui';

const RootLayout = () => (
  <>
    <ErrorBoundary>
      <Outlet />
      <LoginModal />
      <SubscriptionModal />
      <ToastContainer />
    </ErrorBoundary>
    <TanStackRouterDevtools />
  </>
)

export const Route = createRootRoute({ component: RootLayout })