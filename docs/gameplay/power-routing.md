# Power Routing

Once the generator is `Running` and its main breaker is closed, the
distribution panel (control room, west wall) lets the player choose which of
the facility's seven circuits draw power. See
`docs/architecture/power-network.md` for the underlying model and
`docs/level-design/circuit-capacity-balance.md` for why the numbers force a
choice.

## Opening the panel

Walk up to the panel and press `[E] OPEN DISTRIBUTION PANEL`. This opens a
full-screen dialog (`DistributionPanelView`), suspends gameplay input exactly
like the M0.4 inventory overlay, and shows:

- Generator/battery online state and allocated/total capacity.
- One row per circuit: display name, cost, requested/effective state,
  breaker state, description, and a TURN ON/TURN OFF button.

Toggling a circuit calls `DistributionPanelController.toggleCircuit`, which
closes/opens that circuit's `BreakerController` — itself a thin wrapper
around `PowerNetwork.requestCircuit`. A rejection (insufficient capacity,
source unavailable) shows inline and leaves every other circuit untouched —
allocation is atomic; there is no way to end up with a "half-energized"
circuit.

Press `Escape` or the close button to return to gameplay.

## What each circuit powers

See the facility power plan table in
`docs/level-design/facility-power-plan.md` for the full breakdown of loads
per circuit.

## Emergency circuit

The **Emergency & Security** circuit is pre-energized from the emergency
battery at scene boot — see `docs/gameplay/emergency-power.md` — so it
doesn't need to be turned on manually, though its breaker can still be
toggled through the panel to force it onto the generator explicitly.
