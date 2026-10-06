"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyCopy } from "@/components/lesson/DeepDiveView";
import { binarySearchSteps, breadthFirstSteps } from "@/src/lib/explanation/widget-sim";
import { evaluateSafeMath } from "@/src/lib/explanation/safe-math";
import type { InteractiveWidgetSpec } from "@/src/lib/explanation/schema";

const WIDGET = "rounded-2xl border border-border bg-background/50 p-5 sm:p-6";

export function InteractiveView({ widgets }: { widgets: InteractiveWidgetSpec[] }) {
  if (widgets.length === 0) {
    return (
      <EmptyCopy>
        Interactive version not available for this concept yet. Use the process in Understand, or ask for a step-through.
      </EmptyCopy>
    );
  }
  return (
    <div className="space-y-6">
      {widgets.map((widget, index) => (
        <Widget key={`${widget.type}-${index}`} widget={widget} />
      ))}
    </div>
  );
}

function Widget({ widget }: { widget: InteractiveWidgetSpec }) {
  if (widget.type === "generic-step-flow") {
    return <StepFlow title={widget.title} steps={widget.steps.map((step) => ({ id: step.id, title: step.title, detail: step.detail }))} />;
  }
  if (widget.type === "timeline") {
    return <StepFlow title={widget.title} steps={widget.events.map((event) => ({ id: event.id, title: event.label, detail: event.detail }))} />;
  }
  if (widget.type === "binary-search") return <BinarySearchWidget widget={widget} />;
  if (widget.type === "state-machine") return <StateMachineWidget widget={widget} />;
  if (widget.type === "graph-traversal") return <GraphWidget widget={widget} />;
  if (widget.type === "parameter-explorer") return <ParameterWidget widget={widget} />;
  return <CodeTraceWidget widget={widget} />;
}

function StepFlow({
  title,
  steps,
}: {
  title: string;
  steps: { id: string; title: string; detail: string }[];
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  return (
    <section className={WIDGET}>
      <h2 className="font-heading text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Step {index + 1} of {steps.length}
      </p>
      <Progress index={index} count={steps.length} />
      <div className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-xl font-medium">{step.title}</h3>
        <p className="mt-2 max-w-2xl leading-relaxed">{step.detail}</p>
      </div>
      <Pager index={index} count={steps.length} onChange={setIndex} showCount={false} />
    </section>
  );
}

function BinarySearchWidget({
  widget,
}: {
  widget: Extract<InteractiveWidgetSpec, { type: "binary-search" }>;
}) {
  const steps = useMemo(() => binarySearchSteps(widget.array, widget.target), [widget.array, widget.target]);
  const [index, setIndex] = useState(0);
  if (!steps) {
    return (
      <section className={WIDGET}>
        <h2 className="font-heading text-2xl">{widget.title}</h2>
        <p className="mt-3">Interactive version not available until the values are sorted. Binary search does not apply to an unsorted list.</p>
      </section>
    );
  }
  const step = steps[index];
  return (
    <section className={WIDGET}>
      <h2 className="font-heading text-2xl">{widget.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Looking for {widget.target}</p>
      <ol className="mt-4 flex flex-wrap gap-2">
        {widget.array.map((value, valueIndex) => {
          const inside = valueIndex >= step.low && valueIndex <= step.high;
          const mid = valueIndex === step.mid;
          return (
            <li key={`${value}-${valueIndex}`} className={`min-w-10 rounded-lg border px-2.5 py-2 text-center font-mono text-sm transition-colors ${mid ? "border-primary bg-primary text-primary-foreground" : inside ? "border-border bg-card" : "border-border opacity-40"}`}>
              {value}
            </li>
          );
        })}
      </ol>
      <p className="mt-4">
        {step.comparison === "equal"
          ? `Index ${step.mid} holds ${step.value}, which matches the target.`
          : step.comparison === "low"
            ? `${step.value} is below the target, so the search moves right.`
            : `${step.value} is above the target, so the search moves left.`}
      </p>
      <Pager index={index} count={steps.length} onChange={setIndex} />
    </section>
  );
}

function StateMachineWidget({
  widget,
}: {
  widget: Extract<InteractiveWidgetSpec, { type: "state-machine" }>;
}) {
  const [current, setCurrent] = useState(widget.states[0]);
  const options = widget.transitions.filter((transition) => transition.from === current);
  return (
    <section className={WIDGET}>
      <h2 className="font-heading text-2xl">{widget.title}</h2>
      <p className="mt-4 text-sm uppercase tracking-[0.16em] text-muted-foreground">Current state</p>
      <p className="mt-2 font-heading text-3xl">{current}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.length === 0 ? <p className="text-muted-foreground">No transition leaves this state.</p> : null}
        {options.map((transition) => (
          <button key={`${transition.on}-${transition.to}`} type="button" className="button-secondary text-sm" onClick={() => setCurrent(transition.to)}>
            {transition.on}
          </button>
        ))}
      </div>
    </section>
  );
}

function GraphWidget({
  widget,
}: {
  widget: Extract<InteractiveWidgetSpec, { type: "graph-traversal" }>;
}) {
  const steps = useMemo(
    () => breadthFirstSteps(widget.nodes, widget.edges, widget.start),
    [widget.edges, widget.nodes, widget.start],
  );
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) {
    return (
      <section className={WIDGET}>
        <h2 className="font-heading text-2xl">{widget.title}</h2>
        <p className="mt-3">Interactive version not available for this graph yet.</p>
      </section>
    );
  }
  return (
    <section className={WIDGET}>
      <h2 className="font-heading text-2xl">{widget.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Breadth-first from {widget.start}</p>
      <p className="mt-4">Visiting {step.current}</p>
      <p className="mt-2 text-muted-foreground">Visited: {step.visited.join(", ")}</p>
      <p className="text-muted-foreground">Still queued: {step.queue.join(", ") || "none"}</p>
      <Pager index={index} count={steps.length} onChange={setIndex} />
    </section>
  );
}

function ParameterWidget({
  widget,
}: {
  widget: Extract<InteractiveWidgetSpec, { type: "parameter-explorer" }>;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(widget.parameters.map((parameter) => [parameter.name, parameter.initial])),
  );
  const result = evaluateSafeMath(widget.formula, values);
  return (
    <section className={WIDGET}>
      <h2 className="font-heading text-2xl">{widget.title}</h2>
      <p className="mt-3 font-mono text-sm">{widget.formula}</p>
      <div className="mt-4 space-y-4">
        {widget.parameters.map((parameter) => (
          <label key={parameter.name} className="block text-sm">
            {parameter.name}: {values[parameter.name]}
            <input
              className="mt-2 block w-full"
              type="range"
              min={parameter.min}
              max={parameter.max}
              step={parameter.step}
              value={values[parameter.name]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [parameter.name]: Number(event.target.value) }))
              }
            />
          </label>
        ))}
      </div>
      <p className="mt-4">
        {result === null ? "This formula is shown as text. CLEAR only evaluates simple arithmetic." : `Result: ${formatNumber(result)}`}
      </p>
    </section>
  );
}

function CodeTraceWidget({
  widget,
}: {
  widget: Extract<InteractiveWidgetSpec, { type: "code-trace" }>;
}) {
  const [index, setIndex] = useState(0);
  const step = widget.steps[index];
  const lines = widget.code.split("\n");
  return (
    <section className={WIDGET}>
      <h2 className="font-heading text-2xl">{widget.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{widget.language} trace. CLEAR does not run this code.</p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-3 font-mono text-sm">
        {lines.map((line, lineIndex) => (
          <div key={`${line}-${lineIndex}`} className={lineIndex + 1 === step.line ? "-mx-3 border-l-2 border-primary bg-primary/12 px-2.5" : undefined}>
            {line || " "}
          </div>
        ))}
      </pre>
      <p className="mt-4">{step.explanation}</p>
      {step.locals.length > 0 ? (
        <ul className="mt-3 text-sm text-muted-foreground">
          {step.locals.map((local) => (
            <li key={local.name}>
              {local.name} = {local.value}
            </li>
          ))}
        </ul>
      ) : null}
      <Pager index={index} count={widget.steps.length} onChange={setIndex} />
    </section>
  );
}

function Progress({ index, count }: { index: number; count: number }) {
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, step) => (
        <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${step <= index ? "tone-dot" : "bg-muted"}`} />
      ))}
    </div>
  );
}

function Pager({ index, count, onChange, showCount = true }: { index: number; count: number; onChange: (index: number) => void; showCount?: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" className="button-secondary gap-1.5 text-sm" disabled={index === 0} onClick={() => onChange(index - 1)}>
        <ChevronLeft className="size-4" aria-hidden="true" />
        Previous
      </button>
      <button type="button" className="button-primary gap-1.5 text-sm" disabled={index === count - 1} onClick={() => onChange(index + 1)}>
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
      {showCount ? (
        <span className="text-sm text-muted-foreground">
          {index + 1} / {count}
        </span>
      ) : null}
    </div>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
