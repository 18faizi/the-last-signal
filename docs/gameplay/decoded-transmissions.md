# Decoded Transmissions

Once a transmission finishes decoding, a **VIEW TRANSCRIPT** button appears
in the receiver panel header. Opening it shows the decoded text using the
same typed document reader used for pickups and notes elsewhere in the
facility (`docs/gameplay/readable-documents.md`) — but it opens and closes
**inside** the receiver panel rather than returning you to the world:
pressing Escape while reading the transcript closes just the transcript,
back to the receiver panel, not out to gameplay.

## The first transmission

Channel 3 carries the facility's first anomalous transmission — a short,
explicitly provisional auto-transcription. It hints at things the rest of
the story will pick up later (an inconsistent timestamp, a warning not to
restore the rooftop array) without resolving anything itself; see
`docs/level-design/first-transmission-design.md` for the design intent.

## Persistence

A decoded transmission stays decoded for the rest of the session. Closing
the receiver, walking away, and coming back — even power-cycling the
control-room circuit — does not make you re-decode it: reopening the panel
on that channel jumps straight to the completed state and the transcript
is still available.
