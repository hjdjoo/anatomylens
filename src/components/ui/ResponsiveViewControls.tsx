/**
 * ResponsiveViewControls
 * 
 * Wrapper component that renders the appropriate view controls
 * based on viewport size.
 * 
 * - Desktop (≥768px): Full ViewControls panel
 * - Mobile (<768px): MobileViewControls FAB
 */

import { useIsMobile } from '@/hooks/useMediaQuery';
import { ViewControls } from './ViewControls';
import { MobileViewControls } from './MobileViewControls';

export function ResponsiveViewControls() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileViewControls />;
  }

  return <ViewControls />;
}

export default ResponsiveViewControls;
