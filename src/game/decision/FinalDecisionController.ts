/**
 * Milestone 1.0 — Final Decision Controller.
 *
 * Manages prerequisites, selection state, and confirmation for the three endings:
 * - SILENCE (Protocol Omega)
 * - RESPONSE (Protocol Sigma)
 * - ARCHIVE (Protocol Delta)
 */

import type { NarrativeFactRegistry } from '../narrative/NarrativeFactRegistry';
import type { EndingPathway } from '../flow/GameChapter';

export interface DecisionOption {
  readonly id: EndingPathway;
  readonly code: string;
  readonly title: string;
  readonly summary: string;
  readonly narrativeConsequence: string;
}

export const DECISION_OPTIONS: Record<EndingPathway, DecisionOption> = {
  SILENCE: {
    id: 'SILENCE',
    code: 'PROTOCOL OMEGA',
    title: 'Total Station Silence',
    summary:
      'Sever incoming signal carrier, purge demodulation buffer, trip breaker, and seal all station transmission records.',
    narrativeConsequence:
      'The signal is silenced. Station Echo goes cold, preserving containment at the cost of answers.',
  },
  RESPONSE: {
    id: 'RESPONSE',
    code: 'PROTOCOL SIGMA',
    title: 'Broadcast Response',
    summary:
      'Route reverse telemetry pulse through rooftop array to broadcast an acknowledgment packet back to origin bearing.',
    narrativeConsequence:
      'The response is transmitted into the freezing night sky. Something out in the dark receives your coordinates.',
  },
  ARCHIVE: {
    id: 'ARCHIVE',
    code: 'PROTOCOL DELTA',
    title: 'Offline Archive Extraction',
    summary:
      'Extract full raw signal logs and telemetry data into local encrypted magnetic tape before permanently disconnecting.',
    narrativeConsequence:
      'The transmission data is safely preserved on physical magnetic tape for outside investigators.',
  },
};

export class FinalDecisionController {
  private selectedPathway: EndingPathway | null = null;
  private confirmedPathway: EndingPathway | null = null;
  private readonly listeners = new Set<
    (event: { type: 'selected' | 'confirmed' | 'cancelled'; pathway: EndingPathway | null }) => void
  >();

  constructor(private readonly narrativeRegistry: NarrativeFactRegistry) {}

  public subscribe(
    listener: (event: {
      type: 'selected' | 'confirmed' | 'cancelled';
      pathway: EndingPathway | null;
    }) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(
    type: 'selected' | 'confirmed' | 'cancelled',
    pathway: EndingPathway | null,
  ): void {
    for (const listener of this.listeners) {
      try {
        listener({ type, pathway });
      } catch (err) {
        console.error('[FinalDecisionController] Listener error:', err);
      }
    }
  }

  public getOption(pathway: EndingPathway): DecisionOption {
    return DECISION_OPTIONS[pathway];
  }

  public checkPrerequisites(pathway: EndingPathway): {
    available: boolean;
    missingPrerequisites: string[];
  } {
    const missingPrerequisites: string[] = [];

    switch (pathway) {
      case 'SILENCE':
        // Silence is unconditionally available at the final console
        break;

      case 'RESPONSE':
        if (!this.narrativeRegistry.hasFact('FirstTransmissionDecoded')) {
          missingPrerequisites.push('Demodulated transmission packet not decoded');
        }
        if (!this.narrativeRegistry.hasFact('AntennaAligned')) {
          missingPrerequisites.push('Rooftop antenna waveguide array not aligned');
        }
        break;

      case 'ARCHIVE':
        if (!this.narrativeRegistry.hasFact('LocalLoopResultRevealed')) {
          missingPrerequisites.push('Signal loopback source telemetry not analyzed');
        }
        if (!this.narrativeRegistry.hasFact('ArchiveEvidenceDiscovered')) {
          missingPrerequisites.push('Interim anomaly archive document not inspected');
        }
        break;
    }

    return {
      available: missingPrerequisites.length === 0,
      missingPrerequisites,
    };
  }

  public selectPathway(pathway: EndingPathway): boolean {
    const check = this.checkPrerequisites(pathway);
    if (!check.available) {
      return false;
    }
    this.selectedPathway = pathway;
    this.notify('selected', pathway);
    return true;
  }

  public confirmSelectedPathway(): EndingPathway | null {
    if (!this.selectedPathway) return null;
    const pathway = this.selectedPathway;
    this.confirmedPathway = pathway;
    this.notify('confirmed', pathway);
    return pathway;
  }

  public cancelSelection(): void {
    this.selectedPathway = null;
    this.notify('cancelled', null);
  }

  public getSelectedPathway(): EndingPathway | null {
    return this.selectedPathway;
  }

  public getConfirmedPathway(): EndingPathway | null {
    return this.confirmedPathway;
  }

  public reset(): void {
    this.selectedPathway = null;
    this.confirmedPathway = null;
  }
}
