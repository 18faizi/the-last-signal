/**
 * Identifiers for every scene the application can load.
 *
 * Future milestones extend this union (boot, main-menu, gameplay, ending,
 * credits). Using a string union rather than an enum keeps the values
 * readable in the store, the debug overlay and test output.
 */
export type SceneId = 'development' | 'movement-test' | 'interaction-test' | 'access-test';

export const SCENE_IDS: readonly SceneId[] = [
  'development',
  'movement-test',
  'interaction-test',
  'access-test',
];
