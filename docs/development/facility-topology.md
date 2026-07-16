# Facility Topology — Milestone 0.5

Spatial and access relationships between zones, doors and key items.

## Zone connectivity diagram

```mermaid
graph TD
    SPAWN["Spawn\n(-58, 0, 0)"]
    APPROACH["Mountain Approach\nfg-zone-mountain-approach"]
    EXTERIOR["Compound Exterior\nfg-zone-compound-exterior"]
    TUNNEL["Maintenance Tunnel\nfg-zone-maintenance-tunnel"]
    CONTROL["Control Building\nfg-zone-control-building"]
    GENERATOR["Generator Room\nfg-zone-generator-room"]
    RELAY["Relay Room\nfg-zone-relay-room"]
    STAFF["Staff Quarters\nfg-zone-staff-quarters"]
    SUPERVISOR["Supervisor's Office\nfg-zone-supervisor-office"]
    ROOFTOP["Rooftop\nfg-zone-rooftop"]

    SPAWN --> APPROACH
    APPROACH -->|"fg-door-compound-gate\n[compound gate key]"| EXTERIOR
    EXTERIOR -->|"fg-door-tunnel-shortcut\n[gate key OR maint. card]"| TUNNEL
    TUNNEL --> CONTROL
    EXTERIOR --> CONTROL
    CONTROL -->|"fg-door-generator\n[generator key]"| GENERATOR
    CONTROL -->|"fg-door-relay-room\n[antenna card AND override seal]"| RELAY
    CONTROL --> STAFF
    STAFF -->|"fg-door-supervisor\n[supervisor key]"| SUPERVISOR
    CONTROL -->|"fg-door-rooftop\n[antenna access card]"| ROOFTOP
```

## Progression phase graph

```mermaid
stateDiagram-v2
    [*] --> Approach
    Approach --> SecurityCheckpoint
    SecurityCheckpoint --> CompoundEntered
    CompoundEntered --> ControlBuildingReached
    CompoundEntered --> GeneratorAccessed
    ControlBuildingReached --> GeneratorAccessed
    GeneratorAccessed --> ControlBuildingReached
    ControlBuildingReached --> RelayRoomAccessed
    GeneratorAccessed --> RelayRoomAccessed
    RelayRoomAccessed --> StaffQuartersReached
    StaffQuartersReached --> SupervisorOfficeReached
    SupervisorOfficeReached --> RooftopAccessed
    RooftopAccessed --> GreyboxComplete
    GreyboxComplete --> [*]
```

## Key item dependency tree

```
fg-compound-gate-key  ──→  fg-door-compound-gate  ──→  Compound Exterior
                      ──→  fg-door-tunnel-shortcut (AnyOf)
fg-maintenance-card   ──→  fg-door-tunnel-shortcut (AnyOf)

fg-generator-key      ──→  fg-door-generator  ──→  Generator Room

fg-antenna-access-card ─┐
                         ├→  fg-door-relay-room (AllOf)  ──→  Relay Room
fg-override-seal      ──┘
fg-antenna-access-card ──→  fg-door-rooftop  ──→  Rooftop

fg-supervisor-key     ──→  fg-door-supervisor  ──→  Supervisor's Office
```

## Override seal consumption

`fg-override-seal` is a stackable consumable. Picking up both
`fg-pickup-override-seal-1` and `fg-pickup-override-seal-2` grants a
quantity of 2. Each use of `fg-door-relay-room` consumes exactly 1 unit.
The second use would consume the second unit (if it has not already been used).

The antenna access card is retained after all uses.
