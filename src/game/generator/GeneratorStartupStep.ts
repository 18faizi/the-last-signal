/** One readiness condition shown on the status panel / interaction prompts. */
export interface GeneratorStartupStep {
  readonly id: string;
  readonly label: string;
  readonly met: boolean;
}
