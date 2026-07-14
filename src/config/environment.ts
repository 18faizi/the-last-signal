/**
 * Typed access to build-time environment information.
 *
 * All environment checks go through this module so the rest of the codebase
 * never touches `import.meta.env` directly, which keeps environment handling
 * testable and greppable.
 */
export type BuildMode = 'development' | 'production' | 'test';

export interface EnvironmentInfo {
  readonly mode: BuildMode;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
}

function normalizeMode(rawMode: string): BuildMode {
  if (rawMode === 'production') {
    return 'production';
  }
  if (rawMode === 'test') {
    return 'test';
  }
  return 'development';
}

export function readEnvironment(): EnvironmentInfo {
  const mode = normalizeMode(import.meta.env.MODE);
  return {
    mode,
    isDevelopment: mode !== 'production',
    isProduction: mode === 'production',
  };
}

export const environment: EnvironmentInfo = readEnvironment();
