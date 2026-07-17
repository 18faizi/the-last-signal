/**
 * Wires AntennaController + WaveguideController + SourceAnalysisController
 * to the rooftop circuit's power events (via the existing PoweredStateBinding
 * — antenna never polls PowerNetwork itself), to the M0.7 receiver's decoded
 * state, and to the dedicated AntennaProgressionPhase chain
 * (AntennaRuntimeState) — mirrors facilityReceiverBindings.ts's structure
 * exactly, but for a THIRD, separate progression model (see
 * AntennaProgressionPhase.ts's architecture-decision comment).
 *
 * ARCHITECTURE DECISION — ordinal sample-phase naming: FirstArraySampled/
 * SecondArraySampled/DiagnosticLoopSampled advance strictly by HOW MANY
 * samples have been collected so far (1st/2nd/3rd), not by checking WHICH
 * specific array was sampled at each position. The milestone's own
 * documented test sequence samples the diagnostic loop last, but nothing in
 * the domain model requires that order, and enforcing it here would make
 * the antenna panel context-sensitive in a way the spec doesn't otherwise
 * require. The phase names describe the typical intended play order; they
 * are position-based milestones, not per-array assertions.
 */
import { PoweredStateBinding } from '../../../game/electrical/PoweredStateBinding';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { CIRCUIT_ROOFTOP_ANTENNA_ID } from '../power/facilityPowerDefinitions';
import { FACILITY_SIGNALS } from '../signal/facilitySignalDefinitions';
import { FACILITY_ANTENNA_ARRAYS, WAVEGUIDE_EAST_RELAY_ID } from './facilityAntennaDefinitions';

export interface AntennaBindingsHandle {
  dispose(): void;
}

export function bindFacilityAntenna(ctx: FacilitySceneContext): AntennaBindingsHandle {
  const requiredSignalIds = FACILITY_SIGNALS.filter((s) => s.requiredForProgression).map(
    (s) => s.id,
  );
  const isTransmissionDecoded = (): boolean =>
    requiredSignalIds.every((id) => ctx.receiverController.isDecoded(id));

  const reconcilePrerequisites = (): void => {
    if (isTransmissionDecoded()) {
      ctx.antennaRuntimeState.tryAdvancePhase('DecodedSignalRequired');
    }
    if (ctx.antennaController.isPowered) {
      ctx.antennaRuntimeState.tryAdvancePhase('RooftopPowerRequired');
      // Reaching the cabinet powered means it's operable — chain straight
      // through the two "now online / now go fix the waveguide" milestone
      // phases, which describe availability rather than a distinct player
      // action (the real actions — waveguide correction, sampling,
      // comparison — each gate their OWN phase below via real events).
      ctx.antennaRuntimeState.tryAdvancePhase('AntennaPanelOnline');
      ctx.antennaRuntimeState.tryAdvancePhase('WaveguideCorrectionRequired');
    }
    maybeUnlockSampling();
  };

  const maybeUnlockSampling = (): void => {
    // Guarded by the controller's OWN state (not a local closure flag) so a
    // dev full-reset — which resets SourceAnalysisController back to
    // 'Unavailable' — correctly allows re-unlocking on the next playthrough
    // without any stale bookkeeping surviving the reset.
    if (ctx.sourceAnalysisController.analysisState !== 'Unavailable') return;
    const eastRelayCorrected =
      ctx.waveguideController.getState(WAVEGUIDE_EAST_RELAY_ID) === 'Connected';
    if (
      eastRelayCorrected &&
      ctx.antennaController.isPowered &&
      isTransmissionDecoded() &&
      ctx.antennaRuntimeState.antennaPhase === 'WaveguideCorrectionRequired'
    ) {
      ctx.antennaRuntimeState.tryAdvancePhase('ReadyForSamples');
      ctx.sourceAnalysisController.activate();
    }
  };

  const powerBinding = PoweredStateBinding.forCircuit(
    ctx.powerNetwork,
    CIRCUIT_ROOFTOP_ANTENNA_ID,
    (powered) => {
      if (powered) {
        ctx.antennaController.powerOn();
      } else {
        ctx.antennaController.powerOff();
      }
      reconcilePrerequisites();
    },
  );

  // Push waveguide continuity into AntennaController whenever a route
  // changes — event-driven, never per-frame (see AntennaController.ts's
  // doc comment on setWaveguideQuality()).
  for (const def of FACILITY_ANTENNA_ARRAYS) {
    const snapshot = ctx.waveguideController.getSnapshot(def.waveguidePathId);
    ctx.antennaController.setWaveguideQuality(def.id, snapshot?.continuity ?? 0);
  }
  const unsubscribeWaveguide = ctx.waveguideController.subscribe((event) => {
    if (event.pathId === undefined) return;
    const affected = FACILITY_ANTENNA_ARRAYS.filter((a) => a.waveguidePathId === event.pathId);
    for (const def of affected) {
      const snapshot = ctx.waveguideController.getSnapshot(def.waveguidePathId);
      ctx.antennaController.setWaveguideQuality(def.id, snapshot?.continuity ?? 0);
    }
    if (event.kind === 'RouteCorrected') {
      maybeUnlockSampling();
    }
  });

  const unsubscribeReceiver = ctx.receiverController.subscribe((event) => {
    if (event.kind === 'DecodeCompleted') {
      reconcilePrerequisites();
    }
  });

  const unsubscribeSourceAnalysis = ctx.sourceAnalysisController.subscribe((event) => {
    switch (event.kind) {
      case 'SampleCollected': {
        if (event.arrayId !== undefined) {
          ctx.antennaRuntimeState.recordSampleCollected(event.arrayId);
        }
        const count = ctx.sourceAnalysisController.collectedSamples.length;
        if (count === 1) ctx.antennaRuntimeState.tryAdvancePhase('FirstArraySampled');
        else if (count === 2) ctx.antennaRuntimeState.tryAdvancePhase('SecondArraySampled');
        else if (count === 3) ctx.antennaRuntimeState.tryAdvancePhase('DiagnosticLoopSampled');
        break;
      }
      case 'ContradictionDetected':
        ctx.antennaRuntimeState.tryAdvancePhase('BearingContradictionDetected');
        break;
      case 'LocalLoopCandidateDetected':
        ctx.antennaRuntimeState.tryAdvancePhase('LocalLoopCandidate');
        break;
      case 'AnalysisResolved':
        ctx.antennaRuntimeState.tryAdvancePhase('AntennaRevealComplete');
        break;
      default:
        break;
    }
  });

  // Reconcile once at bind time (e.g. checkpoint recovery where power/decode
  // were already true before this scene rebuild ran).
  reconcilePrerequisites();

  return {
    dispose: () => {
      powerBinding.dispose();
      unsubscribeWaveguide();
      unsubscribeReceiver();
      unsubscribeSourceAnalysis();
    },
  };
}
