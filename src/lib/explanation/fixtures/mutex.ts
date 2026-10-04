import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export const MUTEX_FIXTURE: ExplanationDocument = {
  schemaVersion: "1.0",
  id: "00000000-0000-4000-8000-000000000001",
  topic: "How a mutex prevents a race condition",
  normalizedQuestion: "How does a mutex prevent a race condition?",
  audience: {
    level: "engineer",
    assumedKnowledge: ["A program can run more than one thread."],
    desiredDepth: "balanced",
  },
  learningObjectives: [
    {
      id: "explain-mutex",
      statement: "Explain how one mutex serializes a critical section.",
      conceptIds: ["mutex", "critical-section", "race-condition"],
    },
  ],
  prerequisites: [
    { id: "thread", name: "Thread" },
    { id: "shared-state", name: "Shared state" },
  ],
  essence: "A mutex lets only one thread at a time enter a protected critical section.",
  whyItMatters:
    "Without a shared lock protocol, two threads can read the same value, both compute a new one, and one write silently destroys the other.",
  concepts: [
    {
      id: "thread",
      name: "Thread",
      definition: "A thread is a sequence of instructions that can run alongside other threads in the same process.",
      plainExplanation: "Threads share the process memory, so they can touch the same variables.",
      importance: "The race exists only because more than one thread can run.",
      dependsOn: [],
    },
    {
      id: "shared-state",
      name: "Shared state",
      definition: "Shared state is data that more than one thread can read or write.",
      plainExplanation: "A counter, a queue, or a balance is shared state when several threads use it.",
      importance: "Private data does not need a mutex. Shared data can.",
      dependsOn: ["thread"],
    },
    {
      id: "race-condition",
      name: "Race condition",
      definition: "A race condition is a bug where the result depends on which thread runs first.",
      plainExplanation: "Both threads read 1, both add 1, and both write 2. The counter should be 3.",
      importance: "The bug can disappear in a debugger because the timing changes.",
      dependsOn: ["shared-state"],
    },
    {
      id: "critical-section",
      name: "Critical section",
      definition: "A critical section is the stretch of code that touches shared state and must not overlap.",
      plainExplanation: "It is the few lines where the shared value is read, changed, and written back.",
      importance: "The lock protects this stretch, not the entire program.",
      dependsOn: ["race-condition"],
    },
    {
      id: "mutex",
      name: "Mutex",
      definition: "A mutex is a lock with one owner. Another thread waits until the owner unlocks it.",
      plainExplanation: "Lock, do the critical section, unlock. The second thread cannot start until the first unlocks.",
      importance: "The mutex is the protocol that turns an overlapping update into a sequence.",
      dependsOn: ["critical-section"],
    },
    {
      id: "lock-ownership",
      name: "Lock ownership",
      definition: "Lock ownership means exactly one thread holds the mutex and is allowed into the critical section.",
      plainExplanation: "The owner is the only thread that may unlock that mutex.",
      importance: "Two different mutexes do not create one owner for the same data.",
      dependsOn: ["mutex"],
    },
  ],
  relationships: [
    {
      from: "thread",
      to: "shared-state",
      type: "contains",
      explanation: "Threads in one process can reach the same memory.",
    },
    {
      from: "shared-state",
      to: "race-condition",
      type: "causes",
      explanation: "Overlapping updates of shared state produce timing-dependent results.",
    },
    {
      from: "mutex",
      to: "critical-section",
      type: "precedes",
      explanation: "A thread must acquire the mutex before entering the critical section.",
    },
    {
      from: "lock-ownership",
      to: "mutex",
      type: "depends-on",
      explanation: "Ownership is the mutex rule that only the holder may proceed.",
    },
  ],
  process: {
    title: "Two threads, one mutex",
    steps: [
      { id: "request-a", text: "Thread A requests the lock." },
      { id: "free", text: "The mutex is free, so thread A becomes the owner." },
      { id: "update-a", text: "Thread A reads and updates the shared state." },
      { id: "request-b", text: "Thread B requests the same lock and waits." },
      { id: "unlock", text: "Thread A unlocks." },
      { id: "acquire-b", text: "Thread B acquires the lock and then updates the shared state." },
    ],
  },
  mentalModel: {
    intuition: "Only the thread that holds the lock may touch the shared data.",
    analogy: {
      description: "A single key opens one work room. The person holding the key may enter. Everyone else waits outside.",
      mapping: [
        { source: "Key", target: "Mutex ownership" },
        { source: "Work room", target: "Critical section" },
        { source: "People waiting", target: "Threads blocked on the same mutex" },
      ],
      limitations: [
        "A real mutex is enforced by the operating system, the runtime, or hardware synchronization. There is no physical key.",
        "The analogy fails if two threads use two different mutexes for the same data. Two keys for two doors do not protect one shared value.",
      ],
    },
  },
  terminology: [
    { term: "Mutex", definition: "A mutual-exclusion lock with at most one owning thread." },
    { term: "Critical section", definition: "Code that accesses shared state and must run one thread at a time." },
    { term: "Race condition", definition: "A bug whose result depends on thread timing." },
  ],
  examples: [
    {
      id: "counter",
      title: "A shared counter",
      setup: "Two threads each add 1 to a counter that starts at 0. The correct result is 2.",
      walkthrough: [
        "Without a mutex, both threads can read 0 before either writes.",
        "Each thread computes 1 and writes 1. One increment is lost.",
        "With one mutex around the read-add-write, the second thread waits until the first writes 1.",
        "The second thread then reads 1 and writes 2.",
      ],
      takeaway: "The mutex protects the whole update, not just the write.",
    },
  ],
  visualizations: [
    {
      id: "mutex-sequence",
      type: "sequence",
      title: "Thread A, the mutex, thread B, and the shared value",
      textEquivalent:
        "Thread A locks the mutex, updates the shared value, and unlocks. Thread B's lock request waits until that unlock, then thread B updates the shared value.",
      mermaid: `sequenceDiagram
  participant A as Thread A
  participant M as Mutex
  participant B as Thread B
  participant S as Shared state
  A->>M: lock
  M-->>A: acquired
  A->>S: update
  B->>M: lock
  Note over B,M: B waits
  A->>M: unlock
  M-->>B: acquired
  B->>S: update`,
    },
  ],
  interactives: [
    {
      type: "generic-step-flow",
      title: "Watch the lock change hands",
      steps: [
        { id: "a-lock", title: "A requests the lock", detail: "The mutex is free, so A becomes the owner." },
        { id: "a-work", title: "A updates shared state", detail: "B cannot enter yet." },
        { id: "b-wait", title: "B requests the same lock", detail: "B waits because A still owns it." },
        { id: "handoff", title: "A unlocks and B enters", detail: "B now owns the mutex and can update the shared state." },
      ],
    },
  ],
  misconceptions: [
    {
      misconception: "Any lock around the data prevents the race.",
      correction: "Both threads must use the same mutex, or the same protocol, for that shared value.",
      whyItOccurs: "A lock feels like a property of the data, but it is only a convention the threads agree to follow.",
    },
  ],
  deepDive: [
    {
      id: "different-mutexes",
      title: "Two mutexes, one variable",
      body: "If thread A locks mutex 1 and thread B locks mutex 2 while both update the same counter, each lock succeeds. The critical sections still overlap. The race remains.",
    },
  ],
  verification: {
    required: false,
    performed: false,
    confidence: "high",
    claims: [
      {
        statement: "A mutex provides mutual exclusion for threads that acquire that same mutex.",
        status: "supported",
        note: "This is the definition of mutual exclusion, not a claim about a specific library version.",
      },
    ],
    caveats: ["This explanation does not cover priority inversion, recursive locks, or a particular language API."],
  },
  quiz: [
    {
      id: "two-mutexes",
      type: "multiple-choice",
      conceptIds: ["mutex", "lock-ownership"],
      question: "If two threads use different mutexes while changing the same shared value, is the race necessarily prevented?",
      options: [
        "Yes. Each thread holds a lock, so the updates are safe.",
        "No. They must coordinate with the same synchronization protocol.",
        "Yes, but only if both threads run on one CPU.",
      ],
      correctAnswer: "No. They must coordinate with the same synchronization protocol.",
      explanation: "Mutual exclusion applies to threads that wait on the same mutex. Two independent locks do not exclude each other.",
      difficulty: 3,
    },
  ],
  followUpSuggestions: [
    "Why does the lock have to wrap the read and the write?",
    "How is a mutex different from a semaphore?",
    "Show this with a numeric counter.",
  ],
  metadata: {
    provider: "sample",
    model: "clear-example",
    generatedAt: "2026-10-04T00:00:00.000Z",
    promptVersion: "canonical-explanation.v1",
  },
};
