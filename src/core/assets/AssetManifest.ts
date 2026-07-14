import type { AssetDescriptor, AssetKind } from './AssetTypes';

/**
 * The typed asset manifest: the single registry of every loadable asset.
 *
 * Milestone 0.1 ships no binary assets, so the manifest is empty — but the
 * validation and typing exist now so later milestones add entries here
 * instead of scattering URLs through scene code.
 */
export const ASSET_MANIFEST: readonly AssetDescriptor[] = [];

const VALID_KINDS: readonly AssetKind[] = ['model', 'texture', 'audio', 'json', 'font'];

/** Returns human-readable problems; an empty array means the manifest is valid. */
export function validateManifest(manifest: readonly AssetDescriptor[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const entry of manifest) {
    if (entry.id.trim() === '') {
      problems.push('Asset entry has an empty id');
    }
    if (seenIds.has(entry.id)) {
      problems.push(`Duplicate asset id: '${entry.id}'`);
    }
    seenIds.add(entry.id);
    if (!VALID_KINDS.includes(entry.kind)) {
      problems.push(`Asset '${entry.id}' has unknown kind '${String(entry.kind)}'`);
    }
    if (entry.url.trim() === '') {
      problems.push(`Asset '${entry.id}' has an empty url`);
    }
  }
  return problems;
}
