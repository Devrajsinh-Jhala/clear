export const LEVEL_OPTIONS = [
  ["beginner", "Beginner"],
  ["student", "Student"],
  ["engineer", "Engineer"],
  ["researcher", "Researcher"],
  ["interview", "Interview prep"],
  ["custom", "Custom"],
] as const;

export const DEPTH_OPTIONS = [
  ["quick", "Quick"],
  ["balanced", "Balanced"],
  ["deep", "Deep"],
] as const;

export const EXAMPLE_QUESTIONS = [
  "Why does virtual memory exist?",
  "How does a mutex prevent a race condition?",
  "Explain backpropagation visually.",
  "Walk me through this code.",
];
