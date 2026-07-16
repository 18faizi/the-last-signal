/** Branded identifier for a power circuit. */
export type PowerCircuitId = string & { readonly __brand: 'PowerCircuitId' };

export function asPowerCircuitId(id: string): PowerCircuitId {
  return id as PowerCircuitId;
}
