# Signal Lock and Decode

## Status messages

The panel shows exactly one status line, chosen from the receiver's actual
mode and lock state (never guessed from partial information):

| Status               | Meaning                                                           |
| -------------------- | ----------------------------------------------------------------- |
| NO SIGNAL            | Nothing detectable on the tuned channel/frequency.                |
| SCANNING             | The automatic sweep is running.                                   |
| CARRIER DETECTED     | Something's there, but quality isn't high enough to start a lock. |
| ACQUIRING LOCK       | Quality has cleared the lock threshold; the lock bar is filling.  |
| LOCKED               | Lock acquired; decode hasn't started yet.                         |
| DECODING             | Lock held, decode bar filling.                                    |
| SIGNAL UNSTABLE      | Still locked, but quality dipped — decode paused, not lost.       |
| SIGNAL LOST          | The lock broke; you'll need to re-tune and re-acquire it.         |
| TRANSMISSION DECODED | Done — the transcript is available.                               |

## Locking on

Once every control is close enough to the target (see
`docs/gameplay/frequency-tuning.md` and
`docs/architecture/signal-evaluation.md`), the lock bar fills over about two
seconds of continuously-good quality. A brief dip doesn't restart the bar
from zero — it drains gradually, so momentary jitter is forgiving — but
tuning far off cancels it immediately.

## Holding lock

Once locked, small quality dips (SIGNAL UNSTABLE) pause decoding without
losing progress — recover your tuning and decoding resumes from where it
left off. A serious loss of tuning breaks the lock outright (SIGNAL LOST):
decode progress resets, and you'll need to re-acquire lock from scratch.

## Decoding

Decode takes about five seconds of continuously held lock. Progress is
preserved through pauses but not through a full lock loss. Completion is a
one-time event per transmission — see
`docs/gameplay/decoded-transmissions.md` for what happens next.
