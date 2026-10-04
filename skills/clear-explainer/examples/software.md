# Software example: a mutex and a shared counter

This is a public, synthetic example of a teaching choice, not a required answer
template. Use it to calibrate a concurrency explanation.

**Example request:** "Why do two workers need a mutex when incrementing a counter?"

**Essence:** A mutex allows one participating worker at a time into a protected
section of code, so their updates do not overlap.

Assume an increment consists of reading a counter, adding one locally, and writing
the result. With a starting value of 0, worker A can read 0 and worker B can also
read 0 before either writes. Both then write 1. Two requested increments have
produced a final value of 1: one update was lost.

Put the entire read-add-write operation inside the same mutex, and require every
worker accessing that protected state to follow the locking rule. A possible
schedule is A locks, reads 0, writes 1, unlocks; then B locks, reads 1, writes 2,
unlocks. Which worker goes first is not guaranteed.

**Analogy:** A room with one key lets one person enter at a time. The key represents
permission to enter the protected section.

**Limit:** A mutex is a synchronization mechanism, not a physical barrier around
all memory. Code that ignores the lock can still access the counter. Locking only
the final write leaves the conflicting reads unprotected. Platform-specific
memory and synchronization guarantees still matter.

**Optional recall prompt:** What happens if each worker locks only while writing,
after both have already read the old value? Wait for the learner's attempt before
giving the solution.
