/** Branded identifier for a signal definition (mirrors PowerCircuitId's pattern). */
export type SignalId = string & { readonly __brand: 'SignalId' };

export function asSignalId(id: string): SignalId {
  return id as SignalId;
}
