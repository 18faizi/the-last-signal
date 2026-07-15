import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { DocumentDefinition } from '../../../game/interaction/documents/DocumentDefinition';
import { AVAILABLE, type ReadableTarget } from '../../../game/interaction/InteractionTarget';

/**
 * PROVISIONAL DEVELOPMENT CONTENT — these documents exist to exercise the
 * reader framework and are not final narrative canon.
 */
export const DEV_DOCUMENTS: readonly DocumentDefinition[] = [
  {
    id: 'doc-maintenance-note',
    title: 'MAINTENANCE NOTE — ANTENNA FEED',
    date: '14 March',
    author: 'B. Qureshi, Maintenance',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Corrosion found again on the antenna feed junction, north mast. Cleaned the contacts and re-wrapped the joint, but the sealant we have left is old stock and does not cure properly in this cold.',
      },
      {
        kind: 'paragraph',
        text: 'Voltage to the feed amplifier is drifting intermittently — meter shows 11.2 V under load, then recovers to 12.1 V with no obvious cause. It is not the supply; the generator output is steady.',
      },
      {
        kind: 'list',
        items: [
          'Inspect cable junction J-4 behind the equipment rack',
          'Bring proper sealant from the depot on the next run',
          'Log any further voltage drops with time of day',
        ],
      },
      {
        kind: 'paragraph',
        text: 'If the drift shows again before the depot run, pull the spare feed cable from storage and swap it. Do not leave the junction open overnight.',
      },
    ],
  },
  {
    id: 'doc-shift-log',
    title: 'SHIFT LOG — RECEIVER STATION',
    date: '02–03 April',
    author: 'Night shift',
    blocks: [
      {
        kind: 'heading',
        text: '02 April — 22:40',
      },
      {
        kind: 'paragraph',
        text: 'Receiver two came up on its own at 22:31. Nobody touched the rack. Power switch was still in the OFF detent when I checked it, but the tubes were warm and the meter was reading. Cycled the breaker and it went quiet. Logged as a fault.',
      },
      {
        kind: 'heading',
        text: '03 April — 01:15',
      },
      {
        kind: 'paragraph',
        text: 'It happened again. This time I sat with it. The tuning drifted on its own from 3.9 up through 4.2 and stopped there — held steady for six minutes, like a hand was on the dial. Audio was carrier hum only, no voice, no keying. Then it dropped back to noise.',
      },
      {
        kind: 'mono',
        lines: [
          'freq log (approx):',
          '01:16  3.902',
          '01:18  4.048',
          '01:21  4.183',
          '01:22  4.201  (hold)',
          '01:28  drift ends, carrier lost',
        ],
      },
      {
        kind: 'heading',
        text: '03 April — 02:05',
      },
      {
        kind: 'paragraph',
        text: 'Checked the rack wiring with the torch before writing anything down. The receiver two power feed runs through breaker eleven, and breaker eleven was open. I want to be clear about what that means, because I checked it three times: the set was drawing power with its breaker open. I put my meter across the feed and read nothing, and the tubes were still warm and the dial lamp was still lit. I do not have an explanation for that and I am not going to invent one for the log.',
      },
      {
        kind: 'heading',
        text: '03 April — 03:30',
      },
      {
        kind: 'paragraph',
        text: 'Called the supervisor at the exchange. He was awake, which surprised me at that hour. He answered before the second ring, as if he had been sitting with his hand on the receiver. Instructions were short: do not log the frequency in the day book, keep the receiver powered, and note the exact times of any further activity on a separate sheet for him only.',
      },
      {
        kind: 'paragraph',
        text: 'Asked him what the frequency was. He said it was a calibration artifact and hung up. I have worked here nine years. We have never calibrated anything at four megahertz at one in the morning, and no calibration I have ever seen holds a drift and then lets it go.',
      },
      {
        kind: 'heading',
        text: '03 April — 05:40',
      },
      {
        kind: 'paragraph',
        text: 'Nothing further from the set. I spent the rest of the shift with the volume up and heard only the usual noise floor. Karim came through around five to check the generator log and I told him about it. He did not laugh. He said the day shift had the same thing on receiver two back in February and were told the same words: calibration artifact. He asked me not to put his name in the log. I am respecting that, but I am noting that I am not the first.',
      },
      {
        kind: 'paragraph',
        text: 'Aslam takes over at 06:00. I am leaving this log where he will find it, under the tea tin where the supervisor does not look. If the receiver comes up on his shift, someone other than me should see it happen. Whatever this is, it is not a fault, and I am tired of writing the word fault in this book.',
      },
    ],
  },
];

/** A readable document prop: thin pale slab on a surface. */
export function createReadableDocument(
  scene: Scene,
  position: Vector3,
  options: { id: string; documentId: string; label: string; rotationY?: number },
): ReadableTarget {
  const sheet = CreateBox(
    `${options.id}-sheet`,
    { width: 0.24, height: 0.015, depth: 0.32 },
    scene,
  );
  sheet.position.copyFrom(position);
  sheet.rotation.y = options.rotationY ?? 0;
  const material = new StandardMaterial(`${options.id}-mat`, scene);
  material.diffuseColor = new Color3(0.78, 0.76, 0.7);
  material.specularColor = Color3.Black();
  sheet.material = material;

  return {
    id: options.id,
    kind: 'read',
    documentId: options.documentId,
    meshes: [sheet],
    getPrompt: () => ({ verb: 'READ', label: options.label }),
    getAvailability: () => AVAILABLE,
    interact: () => ({ status: 'completed' as const }),
  };
}
