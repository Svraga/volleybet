import { create } from 'zustand'

interface AlertState {
  isOpen: boolean
  message: string
  showAlert: (msg: string) => void
  closeAlert: () => void
}

export const useAlertStore = create<AlertState>((set) => ({
  isOpen: false,
  message: "",
  showAlert: (msg: string) => set({ isOpen: true, message: msg }),
  closeAlert: () => set({ isOpen: false, message: "" }),
}))

export const brutalAlert = (msg: string) => {
  useAlertStore.getState().showAlert(msg)
}
