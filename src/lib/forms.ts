export class FormError extends Error {}

export function errorMessage(error: unknown, fallback = "Operazione non riuscita. Riprova.") {
  return error instanceof Error ? error.message : fallback
}
