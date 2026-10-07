import { ArrowRight, Check, FileText, Folder, Layers, MessageSquareText, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DocumentViews } from "@/components/landing/document-views";
import { LevelDemo } from "@/components/landing/level-demo";
import { SUPPORT_URL } from "@/components/support/chai-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/** A key phrase with a highlighter stroke that sweeps in as the heading scrolls into view. */
function Mark({ children }: { children: ReactNode }) {
  return <span className="marker marker-scroll">{children}</span>;
}

function SectionHeading({ id, label, title, children }: { id: string; label: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="reveal max-w-2xl">
      <p className="eyebrow">{label}</p>
      <h2 id={id} className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {children ? <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">{children}</p> : null}
    </div>
  );
}

const STEPS = [
  [MessageSquareText, "Ask your way", "Type a question, speak it, or attach an image or a PDF. Choose your level and how deep to go."],
  [Layers, "CLEAR builds one explanation", "A single checked document: concepts, relationships, a mental model, examples and a quiz. Every view is drawn from it."],
  [Sparkles, "Learn until it clicks", "Switch views, ask follow-ups that update the same lesson, then quiz yourself or teach it back."],
] as const;

export function StepsSection() {
  return (
    <section className="border-b border-border" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="steps-title" label="How it works" title={<>From a question to <Mark>real understanding.</Mark></>} />
        <div className="relative mt-12">
          {/* The steps share one top rule. On wide screens a dot runs along it as the reader scrolls past. */}
          <div className="absolute inset-x-0 top-0 hidden h-px md:block" aria-hidden="true">
            <span className="step-runner absolute -top-1 -ml-1 size-2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]" />
          </div>
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map(([Icon, title, text], index) => (
              <li key={title} className="reveal border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                  <span className="font-mono text-sm text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function ViewsSection() {
  return (
    <section className="border-b border-border bg-muted/40" aria-labelledby="views-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="views-title" label="Ten views of one explanation" title={<>One document, <Mark>explained ten ways.</Mark></>}>
          CLEAR writes one checked explanation document, and every view reads from it, so the diagram, the analogy and the quiz never disagree. Choose a view to see what it reads.
        </SectionHeading>
        <DocumentViews />
      </div>
    </section>
  );
}

export function LevelSection() {
  return (
    <section className="border-b border-border" aria-labelledby="level-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="level-title" label="Your level" title={<>The same idea, <Mark>at your level.</Mark></>}>
          Pick a level and the words change. The truth does not. Then answer one question, the way every lesson ends.
        </SectionHeading>
        <LevelDemo />
        <p className="mt-4 text-sm text-muted-foreground">These four samples are written by hand. Your lesson is generated for your own question.</p>
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
    <section className="border-b border-border bg-muted/40" aria-labelledby="providers-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <SectionHeading id="providers-title" label="Model independent and private" title="Any model. Your keys. Your data.">
          The model is an implementation detail. The way CLEAR teaches stays the same, and your lessons stay yours.
        </SectionHeading>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="surface-panel lift reveal p-6 sm:p-8">
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
          <article className="surface-panel lift reveal p-6 sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight">Private by default</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <Bullet>API keys are encrypted at rest and are never sent back to your browser.</Bullet>
              <Bullet>A guest lesson belongs to the browser that created it. Nobody else can open its address.</Bullet>
              <Bullet>Uploaded images and PDFs stay private. They never get a public link.</Bullet>
              <Bullet>Learning memory is off until you turn it on, and you can delete it.</Bullet>
              <Bullet>Sharing publishes a frozen snapshot that you preview first. You can replace or revoke the link.</Bullet>
            </ul>
            <Link href="/privacy" className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Read the privacy notes <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
    <section className="border-b border-border" aria-labelledby="skill-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-24 lg:grid-cols-2">
        <div>
          <SectionHeading id="skill-title" label="Portable skill" title="Take the way CLEAR explains with you.">
            Export CLEAR&rsquo;s teaching method as an Agent Skill. Choose the learner level, depth, analogies and quizzes, preview every file, and download a ZIP for a compatible AI agent.
          </SectionHeading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Seven files of instructions and examples. No conversations, uploads, learning records or keys.</p>
          <Link href="/skill" className="button-secondary group mt-8 gap-2">
            Build your skill <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="surface-panel reveal overflow-hidden font-mono text-sm" aria-hidden="true">
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
    <section className="border-b border-border bg-muted/40" aria-labelledby="faq-title">
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

const RAYS = [
  ["M176 96 L300 34", "Summary", 38],
  ["M178 103 L306 72", "Mental model", 76],
  ["M180 110 L310 110", "Diagram", 114],
  ["M178 117 L306 148", "Examples", 152],
  ["M176 124 L300 186", "Quiz", 190],
] as const;

/** The CLEAR mark at work: one question goes in, several views come out. The rays draw as it scrolls into view. */
function PrismArt() {
  return (
    <svg viewBox="0 0 420 220" className="h-auto w-full text-foreground" fill="none" aria-hidden="true">
      <path d="M8 110 H128" pathLength="1" className="draw-scroll" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <text x="8" y="98" fill="var(--muted-foreground)" fontSize="11" fontFamily="var(--font-geist-mono)">your question</text>
      {RAYS.map(([path, label, y], index) => (
        <g key={label}>
          <path d={path} pathLength="1" className="draw-scroll" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" opacity={1 - Math.abs(index - 2) * 0.22} />
          <text x="316" y={y} fill="var(--muted-foreground)" fontSize="11" fontFamily="var(--font-geist-mono)">{label}</text>
        </g>
      ))}
      <path d="M148 52 a6 6 0 0 1 10.4 0 l40 69.3 a6 6 0 0 1 -5.2 9 h-80 a6 6 0 0 1 -5.2 -9 Z" fill="var(--card)" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M132 118 l22 -40" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

export function ClosingSection({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="closing-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="reveal max-w-xl">
          <h2 id="closing-title" className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">What are you trying to understand?</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Bring the question you have been putting off. A lesson takes about half a minute.</p>
          <div className="mt-8 flex flex-wrap items-start gap-3">{children}</div>
        </div>
        <div className="hidden w-full max-w-[26rem] justify-self-end lg:block">
          <PrismArt />
        </div>
      </div>
    </section>
  );
}
