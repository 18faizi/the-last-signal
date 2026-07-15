# Readable documents

## Typed content model

Documents are structured data (`DocumentDefinition`): id, title, optional
date/author, and typed blocks — `paragraph`, `heading`, `list`, `mono`
(monospace technical block) and `image-placeholder` (reserved for future
attachments). Definitions are validated on registration
(`DocumentRegistry`); invalid or duplicate documents throw at scene build
time, and a readable target referencing a missing document produces a
recoverable error report, never a crash.

## Rendering safety

`DocumentReaderView` renders exclusively through `createElement` /
`textContent` — no `innerHTML`, no markup interpretation — so document
content is sanitized by construction. Semantic structure: `article`,
`h1`/`h2`, `ul`, `pre`, `figure`.

## Reading mode

Opening a document acquires an input lock (locomotion and look suspend;
the player settles in place), **releases pointer lock** (the reader needs a
free cursor), and suppresses the pointer-lock prompt. The body scrolls for
long content and text is selectable. Closing — Escape, or the Close button
— restores focus to the game canvas, releases the lock and unsuppresses
the prompt; the player clicks to re-capture the mouse, identical to the
initial entry flow. Held movement keys from before the overlay never leak:
returning from any lock resets the edge-detection baseline to the current
pressed set and clears queued jump/reset edges.

## Accessibility

- `role="dialog"` + `aria-modal`; keyboard focus moves to the Close button
  on open and returns to the canvas on close.
- Escape closes; the Close button is tabbable.
- Text is selectable; the article scrolls with the keyboard once focused.
- Layout uses `min(680px, 88vw)` and `max-height: 82vh`, so common browser
  zoom levels stay usable.
- The interaction prompt is hidden while a document is open; gameplay
  movement cannot occur behind the overlay.

## Development documents

`DEV_DOCUMENTS` (maintenance note ~140 words; shift log ~430 words) are
**provisional development content** used to exercise the reader — flagged
as such in the source and not final narrative canon.
