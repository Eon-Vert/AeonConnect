import { create } from 'zustand';

interface UiState {
  panelCaseId: string | null;
  openCase: (id: string) => void;
  closePanel: () => void;
}

/** One side panel for the whole app; every list opens it. */
export const useUi = create<UiState>((set) => ({
  panelCaseId: null,
  openCase: (id) => set({ panelCaseId: id }),
  closePanel: () => set({ panelCaseId: null }),
}));
