import { create } from 'zustand'

interface TourStore {
  isTourActive: boolean;
  setTourActive: (active: boolean) => void;
}

export const useTourStore = create<TourStore>((set) => ({
  isTourActive: false,
  setTourActive: (active) => set({ isTourActive: active }),
}))
