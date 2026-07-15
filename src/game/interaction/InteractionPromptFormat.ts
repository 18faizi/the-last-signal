import type {
  InteractionAvailability,
  InteractionPromptSpec,
  TargetInteractionKind,
} from './InteractionTarget';

/**
 * Pure prompt formatting: converts target data into the display model the
 * prompt view renders. Disabled targets never show the key hint — a key
 * that cannot succeed must not be advertised.
 */
export interface PromptDisplay {
  /** e.g. "[E]" or "[HOLD E]"; empty for disabled targets. */
  readonly keyHint: string;
  /** e.g. "USE SWITCH" or the disabled reason "REQUIRES POWER". */
  readonly text: string;
  readonly disabled: boolean;
}

export function formatPrompt(
  spec: InteractionPromptSpec,
  availability: InteractionAvailability,
  kind: TargetInteractionKind,
  keyLabel: string,
): PromptDisplay {
  if (availability.status === 'disabled' || kind === 'disabled') {
    return { keyHint: '', text: availability.reason ?? spec.label, disabled: true };
  }
  if (availability.status === 'busy') {
    return { keyHint: '', text: `${spec.label}…`, disabled: true };
  }
  const keyHint = kind === 'hold' ? `[HOLD ${keyLabel}]` : `[${keyLabel}]`;
  return { keyHint, text: `${spec.verb} ${spec.label}`.trim(), disabled: false };
}
