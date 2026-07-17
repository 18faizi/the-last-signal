/**
 * Wires ReceiverController to the control-room circuit's power events (via
 * the existing PoweredStateBinding — the receiver never polls PowerNetwork
 * itself) and to both progression models:
 *
 *  - The EXISTING M0.6 shared ProgressionPhase chain: 'ControlRoomPowered'
 *    (unchanged meaning — the circuit is live) and 'ReceiverActivated' /
 *    'PowerNetworkOperational' (now fired the first time the receiver
 *    finishes booting, which is the direct successor of M0.6's one-shot
 *    "[E] ACTIVATE RECEIVER" — the hardware is live and reachable).
 *  - The NEW dedicated SignalProgressionPhase chain (ReceiverRuntimeState),
 *    tracking the deeper tune/detect/lock/decode puzzle this milestone adds
 *    — see SignalProgressionPhase.ts's doc comment for why this is a
 *    separate model rather than more phases bolted onto ProgressionPhase.
 */
import { PoweredStateBinding } from '../../../game/electrical/PoweredStateBinding';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { CIRCUIT_CONTROL_ROOM_ID } from '../power/facilityPowerDefinitions';
import { FACILITY_SIGNALS } from './facilitySignalDefinitions';

export interface ReceiverBindingsHandle {
  dispose(): void;
}

export function bindFacilityReceiver(ctx: FacilitySceneContext): ReceiverBindingsHandle {
  let receiverActivatedRecorded = false;

  const powerBinding = PoweredStateBinding.forCircuit(
    ctx.powerNetwork,
    CIRCUIT_CONTROL_ROOM_ID,
    (powered) => {
      if (powered) {
        ctx.facilityState.tryAdvancePhase('ControlRoomPowered');
        ctx.receiverController.powerOn();
      } else {
        ctx.receiverController.powerOff();
      }
    },
  );

  const unsubscribeMode = ctx.receiverController.subscribeMode((mode) => {
    if (mode === 'Idle' && !receiverActivatedRecorded) {
      receiverActivatedRecorded = true;
      ctx.facilityState.recordReceiverActivated();
      ctx.facilityState.tryAdvancePhase('ReceiverActivated');
      ctx.facilityState.tryAdvancePhase('PowerNetworkOperational');
      ctx.facilityState.recordPowerMilestoneComplete();
      ctx.receiverRuntimeState.tryAdvancePhase('ReceiverOnline');
    }
  });

  const requiredSignalIds = FACILITY_SIGNALS.filter((s) => s.requiredForProgression).map(
    (s) => s.id,
  );

  const unsubscribeEvents = ctx.receiverController.subscribe((event) => {
    switch (event.kind) {
      case 'ChannelActivityDetected':
        ctx.receiverRuntimeState.tryAdvancePhase('SignalDetected');
        break;
      case 'LockAcquired':
        // A sufficiently fast/precise tune (e.g. every control set within
        // the same render tick, as the dev bridge's sequential setters can
        // do) can jump straight from Searching to Acquiring without ever
        // passing through the Candidate state — meaning
        // ChannelActivityDetected can legitimately never fire before lock
        // is acquired. SignalProgressionPhase is strictly linear
        // (SignalDetected required before SignalLocked), so ensure it here
        // too — a no-op if it already fired, otherwise "locking onto it"
        // implies "detecting it" even if the discrete candidate moment was
        // too brief to observe.
        ctx.receiverRuntimeState.tryAdvancePhase('SignalDetected');
        ctx.receiverRuntimeState.tryAdvancePhase('SignalLocked');
        break;
      case 'DecodeCompleted':
        if (event.signalId !== undefined) {
          ctx.receiverRuntimeState.recordDecoded(event.signalId);
        }
        ctx.receiverRuntimeState.tryAdvancePhase('TransmissionDecoded');
        if (requiredSignalIds.every((id) => ctx.receiverController.isDecoded(id))) {
          ctx.receiverRuntimeState.tryAdvancePhase('SignalPuzzleComplete');
        }
        break;
      default:
        break;
    }
  });

  return {
    dispose: () => {
      powerBinding.dispose();
      unsubscribeMode();
      unsubscribeEvents();
    },
  };
}
