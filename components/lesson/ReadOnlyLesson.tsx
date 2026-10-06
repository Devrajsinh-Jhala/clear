"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { DeepDiveView } from "@/components/lesson/DeepDiveView";
import { ExamplesView } from "@/components/lesson/ExamplesView";
import { InteractiveView } from "@/components/lesson/InteractiveView";
import { MentalModelView } from "@/components/lesson/MentalModelView";
import { QuizView } from "@/components/lesson/QuizView";
import { UnderstandView } from "@/components/lesson/UnderstandView";
import { VerifyView } from "@/components/lesson/VerifyView";
import { VisualView } from "@/components/lesson/VisualView";
import { VIEW_META, viewTabClass } from "@/components/lesson/view-meta";
import { byokProviderLabel, parseStoredProvider } from "@/src/lib/ai/byok";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";

const TABS = [
  ["understand", "Understand"],
  ["mental-model", "Mental Model"],
  ["visual", "Visual"],
  ["interactive", "Interactive"],
  ["examples", "Examples"],
  ["deep-dive", "Deep Dive"],
  ["verify", "Verify"],
  ["quiz", "Quiz"],
] as const;

type TabId = (typeof TABS)[number][0];
type ReadOnlyLessonProps = { document: ExplanationDocument; sharedAt?: string };

export function ReadOnlyLesson(props: ReadOnlyLessonProps) {
  // A new snapshot must also reset local quiz answers and widget positions.
  return <SnapshotLesson key={JSON.stringify(props.document)} {...props} />;
}

function SnapshotLesson({ document, sharedAt }: ReadOnlyLessonProps) {
  const [active, setActive] = useState<TabId>("understand");
  const namespace = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const date = sharedAt ? new Date(sharedAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const providerIsShown = document.metadata.provider !== "hidden" && document.metadata.model !== "hidden";
  const providerName = byokProviderLabel(parseStoredProvider(document.metadata.provider).adapterId);

  return (
    <article className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-10">
      <header className="flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div className="min-w-0">
          <p className="badge bg-card">{sharedAt ? "Shared snapshot · read only" : "Read-only lesson"}</p>
          <h1 className="mt-4 break-words font-heading text-4xl leading-[1.08] sm:text-5xl">{document.topic}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Explore the explanation at your own pace. Quizzes and interactive controls work here; your answers stay on this page.
          </p>
          {validDate ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Shared on <time dateTime={sharedAt}>{date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>
            </p>
          ) : null}
          {providerIsShown ? <p className="mt-2 break-words text-xs text-muted-foreground">Explanation model: {providerName} · {document.metadata.model}</p> : null}
        </div>
        <Link href="/ask" className="button-secondary shrink-0 !rounded-full text-sm">Start your own lesson</Link>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="surface-panel p-5 lg:sticky lg:top-24">
          <h2 className="eyebrow">By the end</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {document.learningObjectives.map((objective) => (
              <li key={objective.id} className="flex gap-2.5"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span className="min-w-0 break-words">{objective.statement}</span></li>
            ))}
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">This view cannot change the original lesson or its learning records.</p>
        </aside>

        <div className="min-w-0 space-y-5">
          <div role="tablist" aria-label="Explanation views" aria-orientation="horizontal" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card/85 p-1.5 shadow-sm lg:flex-wrap">
            {TABS.map(([id, label], index) => {
              const selected = active === id;
              const { icon: Icon, hue } = VIEW_META[id];
              return (
                <button
                  key={id}
                  ref={(element) => { tabs.current[index] = element; }}
                  type="button"
                  role="tab"
                  id={`${namespace}-tab-${id}`}
                  aria-selected={selected}
                  aria-controls={`${namespace}-panel-${id}`}
                  tabIndex={selected ? 0 : -1}
                  className={`${hue} ${viewTabClass(selected)}`}
                  onClick={() => setActive(id)}
                  onKeyDown={(event) => {
                    const nextIndex = event.key === "ArrowRight" ? (index + 1) % TABS.length
                      : event.key === "ArrowLeft" ? (index - 1 + TABS.length) % TABS.length
                      : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
                    if (nextIndex < 0) return;
                    event.preventDefault();
                    setActive(TABS[nextIndex][0]);
                    tabs.current[nextIndex]?.focus();
                  }}
                >
                  <Icon className={`size-4 shrink-0 ${selected ? "tone-text" : ""}`} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id={`${namespace}-panel-${active}`} aria-labelledby={`${namespace}-tab-${active}`} tabIndex={0} className={`${VIEW_META[active].hue} surface-panel relative overflow-hidden break-words p-5 sm:p-8`}>
            <div className="tone-dot absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
            {active === "understand" ? <UnderstandView document={document} /> : null}
            {active === "mental-model" ? <MentalModelView document={document} /> : null}
            {active === "visual" ? <VisualView document={document} /> : null}
            {active === "interactive" ? document.interactives.length > 0 ? <InteractiveView widgets={document.interactives} /> : <p className="max-w-2xl text-muted-foreground">This snapshot has no interactive view. The process in Understand explains the steps.</p> : null}
            {active === "examples" ? <ExamplesView document={document} /> : null}
            {active === "deep-dive" ? document.deepDive.length > 0 ? <DeepDiveView document={document} /> : <p className="max-w-2xl text-muted-foreground">This snapshot has no deeper section. Explore another view, or start your own lesson to ask about the assumptions and edge cases.</p> : null}
            {active === "verify" ? <VerifyView document={document} /> : null}
            {active === "quiz" ? document.quiz.length > 0 ? <QuizView items={document.quiz} /> : <p className="max-w-2xl text-muted-foreground">This snapshot has no quiz. Start your own lesson when you want to test the idea.</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
