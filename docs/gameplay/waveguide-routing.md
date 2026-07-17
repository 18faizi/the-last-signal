# Waveguide Routing

A small junction box sits near the antenna deck, separate from the main
control cabinet. Interacting with it (`[E]`) cycles its route through
every candidate port, one press at a time — the prompt label always shows
the CURRENT route so you can tell what you're routed to before committing
further presses.

## The problem

The East Relay Dish's feed starts routed to an inactive **test port** —
someone left a diagnostic jumper in place. Until it's corrected, aligning
the East Relay Dish perfectly still won't get you anywhere: the dish can
point exactly at its target and the panel will still show zero waveguide
continuity for that array, and its analysis readiness will stay at zero
no matter how good the alignment meter looks.

## The fix

Keep pressing `[E]` at the junction box until the route reads **Receiver
Input A/B** (the correct destination) instead of **Test Port (inactive)**.
The junction box remembers your correction — you don't need to redo it
after leaving the area or after a rooftop power cycle.

## Why a separate interaction, not part of the main panel

The junction box is deliberately a SEPARATE physical location and a
simple, immediate `[E]`-press interaction (not a sub-menu inside the
antenna panel) — you have to actually walk over and find it, the same way
a real routing fault would require physically tracing the feed. The main
antenna panel's waveguide status display is READ-ONLY: it tells you the
route is wrong, but fixing it means leaving the cabinet.

Only the East Relay Dish has a waveguide fault — the North Dish and Tower
Diagnostic Loop feeds are already correctly routed.
