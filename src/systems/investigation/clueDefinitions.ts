/**
 * Clue & Structured Document Definitions (Milestone 1.3).
 *
 * 8 narrative-critical documents and associated environmental clues,
 * forming evidence chains that drive narrative facts, puzzle solutions,
 * and Event Director conditions.
 */

import type { StructuredDocument, InvestigationClue, ClueChainDefinition } from './types';

export const STRUCTURED_DOCUMENTS: readonly StructuredDocument[] = [
  {
    id: 'doc-shift-supervisor-log',
    title: 'SHIFT SUPERVISOR LOG — UNIT 2 OVERLOAD REPORT',
    date: '12 November',
    author: 'Shift Supervisor V. Vance',
    zoneId: 'fz-generator-building',
    pages: [
      'Warning: Unit G-2 diesel generator is operating under unstable load balancing. Secondary coolant circuit was intentionally bypassed after the radiator valve seized on November 10th. If turbine RPM exceeds 2800, breaker 3 must be manually latched before engaging auxiliary bus power, or the entire relay rack will short-circuit.',
      'Staff are strictly forbidden from resetting the primary turbine without coolant recirculation active. In emergency shutdown, toggle main bus isolation switch first.',
    ],
    redactedSections: [
      {
        page: 0,
        index: 1,
        redactedPlaceholder: '[MAINTENANCE OVERRIDE CODE PURGED]',
        unredactedText: 'Override pin: 3-8-1-2',
      },
    ],
    revealedFlag: 'investigation.generator_overload_logged',
    flipNotes:
      'Handwritten pencil on back: "Keep breaker 3 engaged before starting primary turbine. Do not trust the digital meter."',
    associatedClueIds: ['clue-generator-bypass'],
  },
  {
    id: 'doc-signal-technician-note',
    title: 'SIGNAL TECHNICIAN BENCH NOTE',
    date: '13 November',
    author: 'J. Tariq, Lead Communications Tech',
    zoneId: 'fz-control-building',
    pages: [
      'Receiver Unit R-2 is pulling an unexplained harmonic wave centered at 104.7 MHz. This is outside our assigned government telemetry bands. When audio demodulation was engaged, the noise floor fell silent and an organized periodic cadence began transmitting.',
      'Receiver sensitivity must be calibrated with 0.15 MHz bandwidth dampening. If anyone tries listening on 104.7 MHz, do not use the station horn loudspeakers—use localized headphones only.',
    ],
    revealedFlag: 'investigation.harmonic_frequency_discovered',
    unlocksSignalFrequency: 104.7,
    flipNotes:
      'Schematic doodle showing harmonic peak at 104.7 MHz with note: "Carrier rhythm repeats every 47 minutes."',
    associatedClueIds: ['clue-harmonic-carrier'],
  },
  {
    id: 'doc-security-incident-report',
    title: 'SECURITY INCIDENT REPORT — SUB-LEVEL BREACH',
    date: '14 November',
    author: 'Officer K. Demir, Station Security',
    zoneId: 'fz-perimeter-gate',
    pages: [
      '02:15 hours: Seismic and motion sensors tripped along Sub-Level Corridor 3. Visual inspection revealed severe acoustic distortion and bent metal structural struts. The steel security barrier was deformed inward as if subject to extreme atmospheric pressure differentials.',
      'Entity sightings: Night watchman reported an amorphous shadow silhouette pacing the unlit catwalks. It does not reflect flashlights. Protocol requires total blackout and immediate shelter in designated secure lockers. It tracks rapid movement and vocal sound.',
    ],
    redactedSections: [
      {
        page: 1,
        index: 0,
        redactedPlaceholder: '[CLASSIFIED ANOMALOUS SPECIMEN 07]',
        unredactedText: 'Specimen: Void Silhouette / Local Loop Entity',
      },
    ],
    revealedFlag: 'investigation.containment_failure_confirmed',
    flipNotes:
      'Bloody fingerprint smudge with note: "It hunts by sound. Crouch and stay still in lockers."',
    associatedClueIds: ['clue-containment-breach'],
  },
  {
    id: 'doc-facility-schematic-fragment',
    title: 'FACILITY CABLE TUNNEL BLUEPRINT FRAGMENT',
    date: 'Archival Blueprint',
    author: 'Civil Engineering Directorate',
    zoneId: 'fz-maintenance-tunnel',
    pages: [
      'Blueprint extract: Sub-surface conduit bypass connecting Generator Building Annex with Control Building Basement. Clearance height: 1.1 meters (crouch clearance only). High-voltage trunk cables run along the southern conduit wall.',
      'Emergency maintenance bulkhead door requires security keypad code 4189. This tunnel bypasses all exterior courtyard weather hazards during severe blizzards.',
    ],
    revealedFlag: 'investigation.tunnel_bypass_unlocked',
    unlocksDoorCode: '4189',
    flipNotes: 'Red stamp: "ACCESS CODE 4189 — KEEP TUNNEL HATCH LATCHED IN SEVERE COLD"',
    associatedClueIds: ['clue-tunnel-schematic'],
  },
  {
    id: 'doc-cryo-coolant-card',
    title: 'CRYO-COOLANT MAINTENANCE CARD',
    date: '10 November',
    author: 'Facilities Maintenance Team',
    zoneId: 'fz-generator-building',
    pages: [
      'Radiator secondary loop: Glycol-coolant mixture level at 42%. Valve 2 is stuck in 15% open position. To avoid catastrophic vapor lock during generator startup, coolant flow must be verified prior to engaging main load.',
    ],
    revealedFlag: 'investigation.coolant_pressure_verified',
    flipNotes: 'Pencil sketch: "Valve 2 requires clockwise quarter-turn to lock open."',
    associatedClueIds: ['clue-coolant-pressure'],
  },
  {
    id: 'doc-perimeter-surveillance-memo',
    title: 'PERIMETER FENCE SURVEILLANCE MEMO',
    date: '11 November',
    author: 'Watch Post 3',
    zoneId: 'fz-perimeter-gate',
    pages: [
      'Exterior perimeter sensor grid has recorded 6 fence vibration triggers along Sector B fence line (bearing 017°). Infrared cameras captured no thermal signature, yet physical wire tension sensors detected heavy lateral strain moving directly against 45 knot prevailing polar winds.',
    ],
    revealedFlag: 'investigation.perimeter_breach_detected',
    flipNotes: '"Whatever is out there did not come from the road. It came down from the ridge."',
    associatedClueIds: ['clue-perimeter-movement'],
  },
  {
    id: 'doc-telemetry-calibration-sheet',
    title: 'WAVEGUIDE TELEMETRY CALIBRATION SHEET',
    date: '08 November',
    author: 'Array Engineer S. Chen',
    zoneId: 'fz-antenna-deck',
    pages: [
      'Waveguide array alignment notes: Azimuth target 017°, Elevation 42°. Waveguide routing must be switched to array position 2 for optimal carrier SNR. When locked, harmonic signal displays 98% phase coherence with internal station clocks.',
    ],
    revealedFlag: 'investigation.telemetry_calibration_aligned',
    unlocksSignalFrequency: 104.7,
    flipNotes: '"Phase coherence with our own clocks means the transmitter is echoing us."',
    associatedClueIds: ['clue-bearing-telemetry'],
  },
  {
    id: 'doc-archival-evacuation-protocol',
    title: 'ARCHIVAL EVACUATION PROTOCOL — DIRECTIVE 104',
    date: '04 November',
    author: 'Station Directorate',
    zoneId: 'fz-supervisor-office',
    pages: [
      'Directive 104 Authorization: In the event of catastrophic station containment loss or temporal signal corruption, the Central Command Terminal must be placed into emergency resolution mode. Master Administrative Access Key is 8472.',
      'Three authorized protocol directives: Protocol 1: SILENCE (Sever transmission lines), Protocol 2: RESPONSE (Broadcast reciprocal frequency), Protocol 3: ARCHIVE (Lockdown and preserve telemetry records).',
    ],
    revealedFlag: 'investigation.directive_104_acquired',
    unlocksDoorCode: '8472',
    flipNotes: '"Terminal Master Code: 8-4-7-2. Confirm before final transmission execution."',
    associatedClueIds: ['clue-directive-104'],
  },
];

export const INVESTIGATION_CLUES: readonly InvestigationClue[] = [
  {
    id: 'clue-generator-bypass',
    title: 'Generator Coolant Bypass Warning',
    description:
      'Supervisor Vance noted that Generator G-2 coolant valve is bypassed; Breaker 3 must be latched to avoid relay burnout.',
    sourceDocumentId: 'doc-shift-supervisor-log',
    zoneId: 'fz-generator-building',
    clueType: 'document',
    linkedClueIds: ['clue-coolant-pressure'],
    revealedFlag: 'clue.generator_bypass_discovered',
  },
  {
    id: 'clue-coolant-pressure',
    title: 'Radiator Flow Tolerance',
    description:
      'Facilities maintenance recorded secondary glycol coolant at 42% capacity with valve 2 requiring manual setting.',
    sourceDocumentId: 'doc-cryo-coolant-card',
    zoneId: 'fz-generator-building',
    clueType: 'document',
    linkedClueIds: ['clue-generator-bypass'],
    revealedFlag: 'clue.coolant_pressure_discovered',
  },
  {
    id: 'clue-harmonic-carrier',
    title: 'Harmonic Carrier (104.7 MHz)',
    description:
      'Tech note specifies an anomalous carrier broadcasting at 104.7 MHz with 47-minute cadence and acoustic warnings.',
    sourceDocumentId: 'doc-signal-technician-note',
    zoneId: 'fz-control-building',
    clueType: 'document',
    linkedClueIds: ['clue-bearing-telemetry'],
    revealedFlag: 'clue.harmonic_carrier_discovered',
    unlocksSignalFrequency: 104.7,
    narrativeFactId: 'FirstTransmissionDecoded',
  },
  {
    id: 'clue-bearing-telemetry',
    title: 'Antenna Azimuth Alignment (017°)',
    description:
      'Array telemetry sheet sets optimal azimuth bearing at 017° and elevation at 42° with internal clock synchronization.',
    sourceDocumentId: 'doc-telemetry-calibration-sheet',
    zoneId: 'fz-antenna-deck',
    clueType: 'document',
    linkedClueIds: ['clue-harmonic-carrier'],
    revealedFlag: 'clue.bearing_telemetry_discovered',
    narrativeFactId: 'AntennaAligned',
  },
  {
    id: 'clue-containment-breach',
    title: 'Sub-Level Entity Breach',
    description:
      'Security incident reports physical corridor deformation and an acoustic-tracking shadow entity in the sub-levels.',
    sourceDocumentId: 'doc-security-incident-report',
    zoneId: 'fz-perimeter-gate',
    clueType: 'document',
    linkedClueIds: ['clue-perimeter-movement'],
    revealedFlag: 'clue.containment_breach_discovered',
    narrativeFactId: 'SecurityLogRead',
  },
  {
    id: 'clue-perimeter-movement',
    title: 'Sector B Fence Sensor Breach',
    description:
      'Fence motion sensors detected non-thermal physical movement against high arctic winds along bearing 017°.',
    sourceDocumentId: 'doc-perimeter-surveillance-memo',
    zoneId: 'fz-perimeter-gate',
    clueType: 'document',
    linkedClueIds: ['clue-containment-breach'],
    revealedFlag: 'clue.perimeter_movement_discovered',
  },
  {
    id: 'clue-tunnel-schematic',
    title: 'Cable Tunnel Bypass Code (4189)',
    description:
      'Engineering blueprint fragment reveals the sub-surface conduit bypass between generator and control building with access code 4189.',
    sourceDocumentId: 'doc-facility-schematic-fragment',
    zoneId: 'fz-maintenance-tunnel',
    clueType: 'schematic',
    linkedClueIds: ['clue-directive-104'],
    revealedFlag: 'clue.tunnel_schematic_discovered',
    unlocksDoorCode: '4189',
  },
  {
    id: 'clue-directive-104',
    title: 'Directive 104 Master Override (8472)',
    description:
      'Station evacuation directive authorizes Command Terminal master resolution protocols with authorization code 8472.',
    sourceDocumentId: 'doc-archival-evacuation-protocol',
    zoneId: 'fz-supervisor-office',
    clueType: 'document',
    linkedClueIds: ['clue-tunnel-schematic'],
    revealedFlag: 'clue.directive_104_discovered',
    unlocksDoorCode: '8472',
    narrativeFactId: 'FinalTerminalAccessed',
  },
  {
    id: 'clue-truck-evacuation-log',
    title: 'Abandoned Vehicle 04 Dispatch',
    description:
      'Logistics slip left in the utility truck cab records a landslide blocking the northern mountain pass and severe radio distortion from the antenna array.',
    sourceDocumentId: 'doc-truck-dispatch-slip',
    zoneId: 'fz-perimeter-gate',
    clueType: 'document',
    linkedClueIds: ['clue-perimeter-movement'],
    revealedFlag: 'clue.truck_evacuation_discovered',
  },
];

export const CLUE_CHAINS: readonly ClueChainDefinition[] = [
  {
    id: 'chain-power-stabilization',
    title: 'Auxiliary Power Stabilization Protocol',
    description:
      'Cross-referencing the supervisor log and coolant maintenance sheet reveals the safe startup sequence for Generator Unit G-2.',
    requiredClueIds: ['clue-generator-bypass', 'clue-coolant-pressure'],
    resolvedFactId: 'GeneratorRestored',
    eventDirectorFlag: 'director.generator_stabilization_resolved',
  },
  {
    id: 'chain-signal-alignment',
    title: 'Anomalous Signal Alignment',
    description:
      'Combining technician notes and antenna telemetry confirms target frequency 104.7 MHz on bearing 017°.',
    requiredClueIds: ['clue-harmonic-carrier', 'clue-bearing-telemetry'],
    resolvedFactId: 'AntennaAligned',
    unlockedFrequency: 104.7,
    eventDirectorFlag: 'director.signal_alignment_resolved',
  },
  {
    id: 'chain-containment-truth',
    title: 'Station Infiltration Genesis',
    description:
      'Correlating exterior fence breaches with sub-level corridor structural failures reveals the entity entered from the polar ridge.',
    requiredClueIds: ['clue-containment-breach', 'clue-perimeter-movement'],
    resolvedFactId: 'ThreatEncounterSurvived',
    eventDirectorFlag: 'director.containment_truth_resolved',
  },
  {
    id: 'chain-facility-override',
    title: 'Master Protocol Override',
    description:
      'Unifying the maintenance tunnel blueprint and archival protocol authorizes command terminal execution using code 8472.',
    requiredClueIds: ['clue-tunnel-schematic', 'clue-directive-104'],
    resolvedFactId: 'FinalTerminalAccessed',
    unlockedDoorCode: '8472',
    eventDirectorFlag: 'director.facility_override_resolved',
  },
];
