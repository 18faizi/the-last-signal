/** Branded identifier for a rooftop antenna array (mirrors SignalId/PowerCircuitId's pattern). */
export type AntennaArrayId = string & { readonly __brand: 'AntennaArrayId' };

export function asAntennaArrayId(id: string): AntennaArrayId {
  return id as AntennaArrayId;
}
