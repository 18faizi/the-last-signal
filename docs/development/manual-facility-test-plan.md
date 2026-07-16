# Manual Facility Test Plan — Milestone 0.5

Run these checks manually before merging any changes to the facility scene.
Automated tests cover logic correctness; this plan covers visual and feel.

## 0. Prerequisites

```bash
pnpm dev
```

Open the printed URL. Wait for the loading screen to disappear. The ready
marker should read **"Milestone 0.5 — Facility Greybox"**.

No console errors should appear after boot (check DevTools).

---

## 1. Spawn and orientation

- [ ] Player spawns on the mountain path, facing east (the compound visible ahead).
- [ ] The sky and ground are visible with no geometry clipping through the camera.
- [ ] Movement (WASD), sprint (Shift), crouch (C), jump (Space) all respond.

---

## 2. Mountain approach to compound gate

- [ ] Walk forward from spawn; the compound wall becomes visible.
- [ ] The compound gate is present (large door model or stand-in box).
- [ ] Attempting `E` on the gate without a key shows "Locked" prompt.
- [ ] The compound gate key pickup is visible somewhere on the approach path.
- [ ] Collecting it shows an inventory notification.
- [ ] After collection, `E` on the gate opens it (animation or state change).
- [ ] The player can walk through the open gate.

---

## 3. Tunnel shortcut (AnyOf door)

- [ ] The maintenance tunnel entrance is accessible from the compound exterior.
- [ ] The tunnel shortcut door opens with either the compound gate key or the
      maintenance card (test both paths in separate runs).
- [ ] The tunnel leads to the control building courtyard.

---

## 4. Control building

- [ ] A multi-storey building is visible inside the compound.
- [ ] Stairs from ground floor to upper levels are traversable without clipping.
- [ ] Basement stairs descend to a lower level (negative Y), also traversable.
- [ ] At least one readable document (terminal log / notice) is present and
      opens the document reader on `E`.

---

## 5. Generator room (requires generator key)

- [ ] The generator room door is locked without the generator key.
- [ ] The generator key pickup is findable in the facility.
- [ ] After collection, the generator room door opens.
- [ ] Generator room interior is distinct (coloured differently from hallway).

---

## 6. Relay room (AllOf: card + consumable seal)

- [ ] The relay room door is locked even with only the antenna access card.
- [ ] The relay room door is locked even with only an override seal.
- [ ] With both, the door opens and exactly one seal is consumed from inventory.
- [ ] Two override seal pickups are present; collecting both then opening the
      relay room leaves one seal remaining.

---

## 7. Rooftop (antenna access card)

- [ ] Staircase to rooftop is present and physically traversable.
- [ ] Rooftop door requires the antenna access card.
- [ ] After opening, the rooftop area is accessible (large open area at height).
- [ ] No fall-through gaps in the rooftop floor.

---

## 8. Supervisor's office

- [ ] Supervisor's office door requires the supervisor key.
- [ ] Supervisor key pickup is findable.
- [ ] Office interior has at least one inspectable prop or document.

---

## 9. F9 Facility debug overlay

- [ ] Press `F9`: overlay appears showing phase, zones, doors, pickups.
- [ ] Walk into the compound; overlay updates within ~0.5 s to show zone membership.
- [ ] Open a door; overlay shows that door ID in the opened list.
- [ ] Press `F9` again: overlay disappears.

---

## 10. F8 Teleport menu

- [ ] Press `F8`: a list of named positions appears.
- [ ] Click "Rooftop": player teleports to the rooftop immediately.
- [ ] Click "Spawn": player returns to the spawn point.
- [ ] Press `Escape` or `F8`: menu closes.

---

## 11. Zone progression

- [ ] Check `__TLS_TEST__.getFacilityState()` in the console while on approach: phase = `'Approach'`.
- [ ] Walk into the compound; phase becomes `'CompoundEntered'`.
- [ ] Reach the control building; phase becomes `'ControlBuildingReached'` (or
      `'GeneratorAccessed'` if the generator room was entered first).
- [ ] Visit all key zones; phase eventually reaches `'GreyboxComplete'`.

---

## 12. Out-of-bounds respawn

- [ ] Find a gap or fall off the map (or use console: set Y < -10 with teleport).
- [ ] Player respawns at the last activated checkpoint within ~1 s.
- [ ] No console errors appear on respawn.

---

## 13. Performance (DevTools)

- [ ] In DevTools Performance tab, record 5 s of walking: no frame takes > 50 ms
      (sustained 20+ FPS in software rendering SwiftShader).
- [ ] In DevTools Memory tab, heap does not grow continuously while walking.
- [ ] `__TLS_TEST__.getDiagnostics()` shows `beforeRenderObserverCount` < 20.

---

## 14. Lifecycle leak test

- [ ] Reload the page 3× in quick succession; each reload should boot cleanly
      with no leftover DOM overlays from the previous session.
