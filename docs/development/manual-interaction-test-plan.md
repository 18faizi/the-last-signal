# Manual interaction test plan — Milestone 0.3

Run `pnpm dev`, open the URL, open the browser console (must stay clean).
Click the canvas to capture the mouse. Controls: `WASD` move · mouse look ·
`E` interact · `Esc` release/close · `` ` ``/`F3` overlay · `F4` player
debug · `F6` interaction-ray debug · `R` dev respawn (gameplay) / reset
view (inspection).

## Focus and prompts

- [ ] Walk toward the console. From spawn, no prompt is visible.
- [ ] Look at the toggle switch within the near floor strip: `[E] USE SWITCH` appears.
- [ ] Sweep the crosshair slowly across the switch edge: the prompt does
      not flicker (150 ms grace) but clears within ~0.2 s once clearly away.
- [ ] Look between two console targets: focus switches promptly, prompt
      text updates, no double prompts.
- [ ] Stand behind the far floor strip: no prompt (out of range hides it).
- [ ] Look at the CASED SWITCH through the glass pane: no prompt
      (obstruction; transparency does not grant raycast passage). Step
      around the pane: prompt appears.

## Immediate / multi-state / disabled

- [ ] `E` on the switch toggles the indicator red↔green each press; a held
      `E` does not retrigger.
- [ ] Multi-state control: each press advances OFF→STANDBY→ACTIVE→FAULT→OFF
      (lamp + prompt label change).
- [ ] AUX panel shows `REQUIRES POWER` with no `[E]`; pressing E does nothing.
- [ ] Async terminal: press E — indicator turns amber, prompt shows busy
      (`TERMINAL…`), a second E during the delay does nothing, then the
      indicator settles. Repeatable.

## Hold (breaker)

- [ ] `[HOLD E] RESET BREAKER`; holding fills the bar smoothly over ~1.5 s.
- [ ] Release at half: bar clears instantly; no completion.
- [ ] Look away mid-hold: cancels. Walk backward out of range mid-hold: cancels.
- [ ] Press Escape mid-hold (releases pointer lock): cancels.
- [ ] Alt-Tab mid-hold: cancels; nothing stuck on return.
- [ ] Full hold: indicator turns green, prompt becomes `BREAKER READY`
      (disabled). Keep holding: no re-trigger. New presses: nothing (non-repeatable).

## Inspection (field radio, relay)

- [ ] `[E] INSPECT FIELD RADIO` → view dims, centered radio, overlay shows
      name/description/hints; WASD does nothing; player stays in place.
- [ ] Mouse rotates the model; pitch stops at ±80°; yaw is free.
- [ ] Wheel zooms; stops at both limits.
- [ ] `R` resets orientation and zoom (does NOT respawn the player).
- [ ] `Esc` closes; you are exactly where you were, looking the same way;
      click re-captures the mouse; movement works with no stale keys.
- [ ] Reopen/close 5×: identical behavior, no duplicate overlays.
- [ ] Repeat for the relay component.

## Documents

- [ ] `[E] READ MAINTENANCE NOTE` → reader opens, focus lands on Close.
- [ ] `[E] READ SHIFT LOG` → long content scrolls (wheel and keyboard);
      text is selectable; interaction prompt is hidden; movement is dead
      behind the overlay; pointer-lock prompt does not appear.
- [ ] Tab reaches Close; Enter closes. Esc also closes.
- [ ] At 150% browser zoom the reader remains usable.
- [ ] After closing, click to re-lock; hold `W` before closing — movement
      must NOT auto-resume from the stale key.

## Priority and child meshes

- [ ] PRIORITY PAIR: aim at the seam between the valves — focus lands on
      PRIMARY VALVE (priority) and remains stable.
- [ ] Aim at the radio's knobs and antenna: prompt is always
      `INSPECT FIELD RADIO` (children resolve to the parent target).

## Debugging

- [ ] `F6` shows the interaction ray, hit marker (green=target,
      yellow=out-of-range, red=blocked) and hit normal; `F4` + `F6`
      together work; both dispose on scene reload (HMR) without errors.
- [ ] Overlay (`F3`) shows Int mode / Focus / distance / availability /
      Ray / Hold % / Input locks / Inspecting / Reading rows updating.

## Production verification

- [ ] `pnpm build && pnpm preview`: game boots, prompts/inspection/reader
      work, `window.__TLS_TEST__` is undefined, F4/F6 do nothing, debug
      overlay does not open, console clean.
