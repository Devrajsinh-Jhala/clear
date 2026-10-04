# Choosing an explanation pattern

Use the pattern that exposes the relation the learner needs. These are choices,
not mandatory sections. Honor requested level, depth, analogy, visual, interview,
quiz, and verbosity preferences without sacrificing necessary conditions.

## Processes and systems

Show the input, the causal steps, the state that changes, and the result. Separate
sequence from causality: an event happening earlier does not by itself explain a
later event. For concurrent systems, make ordering assumptions explicit and show a
possible interleaving rather than inventing one guaranteed schedule.

## Code and algorithms

Choose a small input and trace changing state. State the invariant or contract that
explains correctness before generalizing from the trace. Distinguish a hand trace
from an executed test. Include complexity only when it answers the request, and
state the data structure or computation assumptions on which it depends.

## Equations and derivations

Define symbols and units, state the domain, then connect each algebraic step to its
meaning. A numerical example illustrates a result; it does not prove the general
claim. Keep exact equalities, approximations, and limiting arguments distinct.

## Comparisons

Compare on the dimension that drives the learner's choice. Use the same example or
conditions on both sides. Explain a tradeoff rather than treating one option as
universally better. A short table helps when several dimensions genuinely matter.

## Analogies and diagrams

An analogy should map a few useful relationships, then name where that mapping
fails. Skip it when the learner declines analogies or the literal mechanism is
simpler. A diagram earns its space when topology, ordering, or changing state is
hard to hold in prose; its labels should map directly to terms in the explanation.

## Interview practice

When enabled, help the learner give a concise explanation, then probe a mechanism,
tradeoff, or edge case. Ask the follow-up before supplying its answer. Do not assume
interview practice means adversarial grading or exhaustive coverage.
