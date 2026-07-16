/**
 * Branded identifier for a power source (generator, emergency battery, ...).
 *
 * Branding prevents accidentally passing a raw string meant for a different
 * id family (circuit id, load id) where a source id is expected.
 */
export type PowerSourceId = string & { readonly __brand: 'PowerSourceId' };

export function asPowerSourceId(id: string): PowerSourceId {
  return id as PowerSourceId;
}
