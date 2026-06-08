import { create } from 'zustand'

interface AlertState {
  isOpen: boolean
  message: string
  type: "alert" | "confirm"
  onConfirm?: () => void
  onCancel?: () => void
  showAlert: (msg: string) => void
  showConfirm: (msg: string, onConfirm: () => void, onCancel?: () => void) => void
  closeAlert: () => void
}

export const useAlertStore = create<AlertState>((set) => ({
  isOpen: false,
  message: "",
  type: "alert",
  showAlert: (msg: string) => set({ isOpen: true, message: msg, type: "alert" }),
  showConfirm: (msg: string, onConfirm: () => void, onCancel?: () => void) => 
    set({ isOpen: true, message: msg, type: "confirm", onConfirm, onCancel }),
  closeAlert: () => set({ isOpen: false, message: "", type: "alert" }),
}))

export const brutalAlert = (msg: string) => {
  useAlertStore.getState().showAlert(msg)
}
