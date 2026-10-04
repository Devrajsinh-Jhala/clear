import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export type ConsistencyIssue = {
  path: string;
  message: string;
};

export function validateConsistency(document: ExplanationDocument): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const conceptIds = new Set<string>();

  for (const concept of document.concepts) {
    if (conceptIds.has(concept.id)) {
      issues.push({
        path: `concepts.${concept.id}`,
        message: `Duplicate concept id "${concept.id}".`,
      });
    }
    conceptIds.add(concept.id);
  }

  document.concepts.forEach((concept, index) => {
    for (const dependency of concept.dependsOn) {
      if (!conceptIds.has(dependency)) {
        issues.push({
          path: `concepts.${index}.dependsOn`,
          message: `Concept "${concept.id}" depends on unknown concept "${dependency}".`,
        });
      }
    }
  });

  for (const prerequisite of document.prerequisites) {
    if (!conceptIds.has(prerequisite.id)) {
      issues.push({
        path: "prerequisites",
        message: `Prerequisite "${prerequisite.id}" is not a known concept.`,
      });
    }
  }

  document.relationships.forEach((relationship, index) => {
    if (!conceptIds.has(relationship.from) || !conceptIds.has(relationship.to)) {
      issues.push({
        path: `relationships.${index}`,
        message: "Relationship endpoints must refer to known concepts.",
      });
    }
  });

  document.quiz.forEach((item, index) => {
    for (const conceptId of item.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          path: `quiz.${index}.conceptIds`,
          message: `Quiz item "${item.id}" references unknown concept "${conceptId}".`,
        });
      }
    }
    if (item.type === "multiple-choice" || item.type === "true-false") {
      const options = item.options ?? [];
      if (options.length < 2) {
        issues.push({
          path: `quiz.${index}.options`,
          message: `Quiz item "${item.id}" needs at least two options.`,
        });
      }
      if (typeof item.correctAnswer !== "string" || !options.includes(item.correctAnswer)) {
        issues.push({
          path: `quiz.${index}.correctAnswer`,
          message: `Quiz item "${item.id}" has an answer that is not one of its options.`,
        });
      }
    }
    if (item.type === "ordering" && !Array.isArray(item.correctAnswer)) {
      issues.push({
        path: `quiz.${index}.correctAnswer`,
        message: `Ordering item "${item.id}" needs an ordered list of answers.`,
      });
    }
  });

  document.learningObjectives.forEach((objective, index) => {
    for (const conceptId of objective.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          path: `learningObjectives.${index}.conceptIds`,
          message: `Objective "${objective.id}" references unknown concept "${conceptId}".`,
        });
      }
    }
  });

  const visualizationIds = new Set<string>();
  for (const visualization of document.visualizations) {
    if (visualizationIds.has(visualization.id)) {
      issues.push({
        path: `visualizations.${visualization.id}`,
        message: `Duplicate visualization id "${visualization.id}".`,
      });
    }
    visualizationIds.add(visualization.id);
  }

  document.interactives.forEach((widget, index) => {
    if (widget.type === "state-machine") {
      const states = new Set(widget.states);
      for (const transition of widget.transitions) {
        if (!states.has(transition.from) || !states.has(transition.to)) {
          issues.push({
            path: `interactives.${index}`,
            message: "State machine transitions must use declared states.",
          });
        }
      }
    }
    if (widget.type === "graph-traversal") {
      const nodes = new Set(widget.nodes);
      if (!nodes.has(widget.start)) {
        issues.push({
          path: `interactives.${index}.start`,
          message: "Graph traversal start node is missing from nodes.",
        });
      }
      for (const edge of widget.edges) {
        if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
          issues.push({
            path: `interactives.${index}.edges`,
            message: "Graph edges must connect known nodes.",
          });
        }
      }
    }
  });

  return issues;
}
