import { ArrowRight, Check, FileText, Folder } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { VIEW_META } from "@/components/lesson/view-meta";
import { SUPPORT_URL } from "@/components/support/chai-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function SectionHeading({ id, label, title, children }: { id: string; label: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{label}</p>
      <h2 id={id} className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {children ? <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">{children}</p> : null}
    </div>
  );
}

const STEPS = [
  ["Ask your way", "Type a question, speak it, or attach an image or a PDF. Choose your level and how deep to go."],
  ["CLEAR builds one explanation", "A single checked document: concepts, relationships, a mental model, examples and a quiz. Every view is drawn from it."],
  ["Learn until it clicks", "Switch views, ask follow-ups that update the same lesson, then quiz yourself or teach it back."],
] as const;

export function StepsSection() {
  return (
    <section className="border-b border-border" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="steps-title" label="How it works" title="From a question to real understanding." />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="border-t border-border pt-6">
              <span className="font-mono text-sm text-muted-foreground">0{index + 1}</span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const VIEWS: Array<{ id: string; title: string; text: string }> = [
  { id: "understand", title: "Understand", text: "The idea in one precise sentence, then the mechanism and the terms in plain language." },
  { id: "mental-model", title: "Mental model", text: "An intuition and a labeled analogy that says where the analogy stops being true." },
  { id: "visual", title: "Visual", text: "Diagrams drawn from the same explanation, each with a text version." },
  { id: "interactive", title: "Interactive", text: "Step through a trace or move a parameter. Model-written code never runs." },
  { id: "examples", title: "Examples", text: "Worked examples that walk through the idea one step at a time." },
  { id: "deep-dive", title: "Deep dive", text: "Assumptions, edge cases and the detail a specialist expects." },
  { id: "verify", title: "Verify", text: "What was checked, what was not, and how confident the lesson is." },
  { id: "quiz", title: "Quiz", text: "Questions that test the mechanism, not your memory of the wording." },
  { id: "teach-back", title: "Teach it back", text: "Explain it in your own words. CLEAR finds what is missing or wrong." },
  { id: "voice", title: "Voice tutor", text: "Listen to the lesson, or ask your follow-up out loud." },
];

export function ViewsSection() {
  return (
    <section className="border-b border-border bg-muted/40" aria-labelledby="views-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="views-title" label="Ten views of one explanation" title="One question, explained ten ways.">
          Every view is drawn from the same checked explanation, so the diagram, the analogy and the quiz never disagree with each other.
        </SectionHeading>
        <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-5">
          {VIEWS.map((view) => {
            const Icon = VIEW_META[view.id].icon;
            return (
              <li key={view.id} className="bg-card p-4 sm:p-5">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-medium">{view.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{view.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

const PROVIDERS = ["Google Gemini", "OpenAI", "Anthropic", "xAI", "Any OpenAI-compatible endpoint"];

export function ProvidersSection() {
  return (
    <section className="border-b border-border" aria-labelledby="providers-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="providers-title" label="Model independent and private" title="Any model. Your keys. Your data.">
          The model is an implementation detail. The way CLEAR teaches stays the same, and your lessons stay yours.
        </SectionHeading>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="surface-panel p-6 sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight">CLEAR Free, or bring your own key</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {PROVIDERS.map((provider) => <li key={provider} className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-sm">{provider}</li>)}
            </ul>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <Bullet>CLEAR Free runs on Google Gemini. No sign-in, no key.</Bullet>
              <Bullet>No silent switching between providers. The lesson always names the model that answered.</Bullet>
              <Bullet>Run the same question on two models and keep the clearer explanation.</Bullet>
            </ul>
          </article>
          <article className="surface-panel p-6 sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight">Private by default</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <Bullet>API keys are encrypted at rest and are never sent back to your browser.</Bullet>
              <Bullet>A guest lesson belongs to the browser that created it. Nobody else can open its address.</Bullet>
              <Bullet>Uploaded images and PDFs stay private. They never get a public link.</Bullet>
              <Bullet>Learning memory is off until you turn it on, and you can delete it.</Bullet>
              <Bullet>Sharing publishes a frozen snapshot that you preview first. You can replace or revoke the link.</Bullet>
            </ul>
            <Link href="/privacy" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Read the privacy notes <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

const SKILL_FILES = [
  ["SKILL.md", 0],
  ["references/", -1],
  ["clear-protocol.md", 1],
  ["explanation-patterns.md", 1],
  ["safety-and-accuracy.md", 1],
  ["examples/", -1],
  ["mathematics.md", 1],
  ["science.md", 1],
  ["software.md", 1],
] as const;

export function SkillSection() {
  return (
    <section className="border-b border-border bg-muted/40" aria-labelledby="skill-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-24 lg:grid-cols-2">
        <div>
          <SectionHeading id="skill-title" label="Portable skill" title="Take the way CLEAR explains with you.">
            Export CLEAR&rsquo;s teaching method as an Agent Skill. Choose the learner level, depth, analogies and quizzes, preview every file, and download a ZIP for a compatible AI agent.
          </SectionHeading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Seven files of instructions and examples. No conversations, uploads, learning records or keys.</p>
          <Link href="/skill" className="button-secondary mt-8 gap-2">
            Build your skill <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="surface-panel overflow-hidden font-mono text-sm" aria-hidden="true">
          <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">clear-explainer.zip</p>
          <ul className="space-y-1.5 p-5">
            <li className="flex items-center gap-2.5"><Folder className="size-4 text-primary" />clear-explainer/</li>
            {SKILL_FILES.map(([name, depth]) => (
              <li key={name} className="flex items-center gap-2.5" style={{ paddingLeft: `${depth === 1 ? 2.75 : 1.375}rem` }}>
                {depth === -1 ? <Folder className="size-4 text-primary" /> : <FileText className="size-4 text-muted-foreground" />}
                <span className={depth === -1 ? "" : "text-muted-foreground"}>{name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FAQ: Array<[string, ReactNode]> = [
  ["Is CLEAR free?", "Yes. CLEAR Free runs on Google Gemini with a daily allowance and no sign-in. You can also connect your own API key. Your key is billed by your provider and does not use the CLEAR Free allowance."],
  ["Do I need an account?", "No. A guest lesson belongs to the browser that created it. An account adds a private library that follows you across devices."],
  ["How is this different from asking a chatbot?", "A chatbot gives you an answer. CLEAR builds one structured explanation, shows it ten ways, and then checks whether it clicked. A follow-up updates the same lesson instead of scrolling away."],
  ["Which models can I use?", "CLEAR Free uses Gemini. With your own key you can use Gemini, OpenAI, Anthropic, xAI or any OpenAI-compatible endpoint. The lesson always names the model that answered."],
  ["Can I trust the explanations?", "Treat CLEAR like a good tutor, not an authority. Models can be wrong. Every lesson has a Verify view that says what was and was not checked, and every analogy is labeled with its limits."],
  ["What happens to my questions and files?", <>Your question goes to the model you chose. Uploads stay private and never get a public link. API keys are encrypted and are not sent back to the browser. Learning memory is off until you turn it on. The <Link href="/privacy">privacy notes</Link> have the details.</>],
  ["What is the portable skill?", "A set of instruction files that teach a compatible AI agent to explain the CLEAR way. You configure it, preview it and download a ZIP. It contains no conversations, uploads or keys."],
  ["How can I support CLEAR?", <>Support is optional. If a lesson helped, you can <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">buy the maker a chai<span className="sr-only"> (opens in a new tab)</span></a>. It does not unlock anything: CLEAR Free and your own keys work the same either way.</>],
];

export function FaqSection() {
  return (
    <section className="border-b border-border" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <SectionHeading id="faq-title" label="Questions" title="Before you ask." />
        <Accordion type="single" collapsible className="border-t border-border">
          {FAQ.map(([question, answer], index) => (
            <AccordionItem key={question} value={`faq-${index}`} className="border-b">
              <AccordionTrigger className="py-4 text-base hover:no-underline">{question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function ClosingSection({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="closing-title">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-20 sm:py-24 md:flex-row md:items-center">
        <div className="max-w-xl">
          <h2 id="closing-title" className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">What are you trying to understand?</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Bring the question you have been putting off. A lesson takes about half a minute.</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">{children}</div>
      </div>
    </section>
  );
}
