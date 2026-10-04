export type BinarySearchStep = {
  low: number;
  high: number;
  mid: number;
  value: number;
  comparison: "equal" | "low" | "high";
};

export function isSortedAscending(values: number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) return false;
  }
  return true;
}

export function binarySearchSteps(values: number[], target: number): BinarySearchStep[] | null {
  if (!isSortedAscending(values)) return null;
  const steps: BinarySearchStep[] = [];
  let low = 0;
  let high = values.length - 1;
  while (low <= high && steps.length <= values.length) {
    const mid = Math.floor((low + high) / 2);
    const value = values[mid];
    const comparison = value === target ? "equal" : value < target ? "low" : "high";
    steps.push({ low, high, mid, value, comparison });
    if (comparison === "equal") break;
    if (comparison === "low") low = mid + 1;
    else high = mid - 1;
  }
  return steps;
}

export type GraphStep = {
  current: string;
  visited: string[];
  queue: string[];
};

export function breadthFirstSteps(
  nodes: string[],
  edges: { from: string; to: string }[],
  start: string,
): GraphStep[] {
  const known = new Set(nodes);
  const next = new Map<string, string[]>();
  for (const node of nodes) next.set(node, []);
  for (const edge of edges) {
    if (known.has(edge.from) && known.has(edge.to)) {
      next.get(edge.from)?.push(edge.to);
    }
  }
  const queue = [start];
  const visited: string[] = [];
  const steps: GraphStep[] = [];
  const seen = new Set<string>();
  while (queue.length > 0 && steps.length <= nodes.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    visited.push(current);
    for (const neighbor of next.get(current) ?? []) {
      if (!seen.has(neighbor) && !queue.includes(neighbor)) queue.push(neighbor);
    }
    steps.push({ current, visited: [...visited], queue: [...queue] });
  }
  return steps;
}
