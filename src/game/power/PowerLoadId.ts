/** Branded identifier for a power load (a light, terminal, door, etc). */
export type PowerLoadId = string & { readonly __brand: 'PowerLoadId' };

export function asPowerLoadId(id: string): PowerLoadId {
  return id as PowerLoadId;
}
