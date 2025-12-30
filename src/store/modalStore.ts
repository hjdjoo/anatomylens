/**
 * Modal Store
 * 
 * Manages which modal is currently open.
 * Can be merged into anatomyStore if preferred.
 */

import { create } from 'zustand';

// ============================================================
// TYPES
// ============================================================

export type ModalType = 'login' | 'subscription' | null;

interface ModalState {
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
}

// ============================================================
// STORE
// ============================================================

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,

  openModal: (modal) => set({ activeModal: modal }),

  closeModal: () => set({ activeModal: null }),
}));

// ============================================================
// CONVENIENCE HOOKS
// ============================================================

export function useLoginModal() {
  const { activeModal, openModal, closeModal } = useModalStore();
  return {
    isOpen: activeModal === 'login',
    open: () => openModal('login'),
    close: closeModal,
  };
}

export function useSubscriptionModal() {
  const { activeModal, openModal, closeModal } = useModalStore();
  return {
    isOpen: activeModal === 'subscription',
    open: () => openModal('subscription'),
    close: closeModal,
  };
}
