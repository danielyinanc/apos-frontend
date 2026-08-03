import { create } from 'zustand';

interface UiStore {
  rightRailOpen: boolean;
  toggleRightRail: () => void;
  focusModeId: string | null;
  setFocusMode: (id: string | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  rightRailOpen: true,
  toggleRightRail: () => set((s) => ({ rightRailOpen: !s.rightRailOpen })),
  focusModeId: null,
  setFocusMode: (id) => set({ focusModeId: id }),
}));
