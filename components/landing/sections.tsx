import { ArrowRight, Check, FileText, Folder, KeyRound, Lock } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { SUPPORT_URL } from "@/components/support/chai-button";
import { CountUp } from "@/components/landing/count-up";
import { Reveal } from "@/components/landing/reveal";
import { VIEW_META } from "@/components/lesson/view-meta";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-spectrum pr-[0.08em] font-accent font-normal italic tracking-[-0.01em]">{children}</span>;
}

const VIEWS: Array<{ id: string; title: string; text: string; wide?: boolean }> = [
  { id: "understand", title: "Understand", text: "The idea in one precise sentence, then the mechanism, the concepts and the terms in plain language.", wide: true },
  { id: "mental-model", title: "Mental Model", text: "An intuition and a labeled analogy, with a note on where the analogy stops being true." },
  { id: "visual", title: "Visual", text: "Diagrams drawn from the same explanation, each with a text version." },
  { id: "interactive", title: "Interactive", text: "Step through a trace, move a parameter, walk a state machine. Trusted widgets only; model-written code is never run.", wide: true },
  { id: "examples", title: "Examples", text: "Worked examples that walk through the idea one step at a time." },
  { id: "deep-dive", title: "Deep Dive", text: "Assumptions, edge cases and the detail a specialist expects." },
  { id: "verify", title: "Verify", text: "What was checked, what was not, and how confident the lesson is." },
  { id: "quiz", title: "Quiz", text: "Questions that test the mechanism, not your memory of the wording." },
  { id: "teach-back", title: "Teach it back", text: "Explain it in your own words. CLEAR finds what is missing or wrong." },
  { id: "voice", title: "Voice Tutor", text: "Listen to the lesson, or ask your follow-up out loud." },
];

export function ViewsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28" aria-labelledby="views-title">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Ten views of one explanation</p>
        <h2 id="views-title" className="mt-4 font-heading text-4xl leading-[1.05] sm:text-5xl">
          One question. <Accent>Multiple ways</Accent> to understand.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Every view is drawn from the same explanation document, so the diagram, the analogy and the quiz never disagree with each other.
        </p>
      </Reveal>
      <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {VIEWS.map((view, index) => {
          const { icon: Icon, hue } = VIEW_META[view.id];
          return (
            <li key={view.id} className={view.wide ? "col-span-2" : ""}>
              <Reveal delay={(index % 4) * 70} className="h-full">
                <article className={`${hue} surface-panel lift group relative h-full overflow-hidden p-4 sm:p-6`}>
                  <div className="tone-dot pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40" aria-hidden="true" />
                  <span className="tone-bg tone-text inline-flex size-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 sm:size-11 sm:rounded-2xl">
                    <Icon className="size-4 sm:size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 font-heading text-lg sm:mt-5 sm:text-xl">{view.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground sm:mt-2 sm:text-sm">{view.text}</p>
                  {view.id === "understand" ? (
                    <p className="tone-border mt-4 border-l-2 pl-4 font-heading text-base leading-snug sm:mt-5 sm:text-lg">
                      A mutex lets only one thread at a time enter a protected critical section.
                    </p>
                  ) : null}
                  {view.id === "interactive" ? (
                    <div className="mt-4 flex h-12 items-end gap-1.5 sm:mt-5 sm:h-14" aria-hidden="true">
                      {[35, 60, 45, 85, 55, 100, 70, 40, 90, 65, 50, 80].map((height, bar) => (
                        <span key={bar} className="tone-bg tone-border flex-1 origin-bottom rounded-t-md border border-b-0" style={{ height: `${height}%`, animation: `bars 3.2s ease-in-out ${bar * -380}ms infinite` }} />
                      ))}
                    </div>
                  ) : null}
                </article>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STEPS = [
  ["Ask your way", "Type a question, speak it, or attach an image or a PDF. Choose your level and how deep to go."],
  ["CLEAR builds one explanation", "A single checked document: concepts, relationships, a mental model, examples and a quiz. Every view is drawn from it."],
  ["Learn until it clicks", "Switch views, ask follow-ups that update the same lesson, then quiz yourself or teach it back."],
] as const;

export function StepsSection() {
  return (
    <section className="relative border-y border-border bg-card/40" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 id="steps-title" className="mt-4 font-heading text-4xl leading-[1.05] sm:text-5xl">
            From a question to <Accent>understanding.</Accent>
          </h2>
        </Reveal>
        <div className="relative mt-16">
        <div aria-hidden="true" className="bg-spectrum absolute left-[16.6%] right-[16.6%] top-7 hidden h-0.5 animate-pan rounded-full opacity-70 md:block" />
        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="relative">
              <Reveal delay={index * 140} className="text-center">
                <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-background font-heading text-xl shadow-sm">
                  {index + 1}
                </span>
                <h3 className="mt-6 font-heading text-2xl">{title}</h3>
                <p className="mx-auto mt-3 max-w-xs leading-relaxed text-muted-foreground">{text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        </div>
      </div>
    </section>
  );
}

const PROVIDERS = ["Gemini", "OpenAI", "Anthropic", "xAI", "Your endpoint"];

function RouterDiagram() {
  return (
    <svg viewBox="0 0 420 220" className="h-auto w-full" fill="none" aria-hidden="true">
      {PROVIDERS.map((provider, index) => {
        const y = 22 + index * 44;
        return (
          <g key={provider}>
            <path d={`M196 110 C 250 110, 240 ${y}, 292 ${y}`} stroke={`oklch(0.68 0.18 ${285 + index * 62})`} strokeWidth="1.5" className="stroke-flow" style={{ animationDelay: `${index * -240}ms` }} />
            <rect x="292" y={y - 15} width="120" height="30" rx="15" fill="var(--background)" stroke="var(--border)" />
            <text x="352" y={y + 4.5} textAnchor="middle" fill="var(--foreground)" fontSize="12.5" fontFamily="var(--font-geist-sans)">{provider}</text>
          </g>
        );
      })}
      <path d="M100 110h56" stroke="var(--muted-foreground)" strokeWidth="1.5" className="stroke-flow" />
      <rect x="6" y="92" width="94" height="36" rx="12" fill="var(--background)" stroke="var(--border)" />
      <text x="53" y="114.5" textAnchor="middle" fill="var(--foreground)" fontSize="12.5" fontFamily="var(--font-geist-sans)">Your question</text>
      <circle cx="176" cy="110" r="24" fill="var(--card)" stroke="var(--primary)" strokeWidth="1.5" />
      <circle cx="176" cy="110" r="24" stroke="var(--primary)" strokeWidth="1" opacity="0.4">
        <animate attributeName="r" values="24;34" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Check className="size-3.5" aria-hidden="true" /></span>
      <span>{children}</span>
    </li>
  );
}

export function ProvidersSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28" aria-labelledby="providers-title">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Model independent</p>
        <h2 id="providers-title" className="mt-4 font-heading text-4xl leading-[1.05] sm:text-5xl">
          Any model. <Accent>Your keys.</Accent> Your data.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">The model is an implementation detail. The way CLEAR teaches stays the same.</p>
      </Reveal>
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <article className="surface-panel hue-understand lift h-full p-6 sm:p-8">
            <span className="tone-bg tone-text inline-flex size-11 items-center justify-center rounded-2xl"><KeyRound className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-5 font-heading text-2xl">CLEAR Free, or bring your own key</h3>
            <div className="relative mt-6">
              <RouterDiagram />
              <LogoMark className="absolute left-[41.9%] top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <Bullet>CLEAR Free runs on Google Gemini. No sign-in, no key.</Bullet>
              <Bullet>Connect Gemini, OpenAI, Anthropic, xAI or any OpenAI-compatible endpoint.</Bullet>
              <Bullet>No silent switching between providers. The lesson always names the model that answered.</Bullet>
              <Bullet>Run the same question on two models and keep the clearer explanation.</Bullet>
            </ul>
          </article>
        </Reveal>
        <Reveal delay={120}>
          <article className="surface-panel hue-verify lift h-full p-6 sm:p-8">
            <span className="tone-bg tone-text inline-flex size-11 items-center justify-center rounded-2xl"><Lock className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-5 font-heading text-2xl">Private by default</h3>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <Bullet>API keys are encrypted at rest and are never sent back to your browser.</Bullet>
              <Bullet>A guest lesson belongs to the browser that created it. Nobody else can open its address.</Bullet>
              <Bullet>Uploaded images and PDFs stay private. They never get a public link.</Bullet>
              <Bullet>Learning memory is off until you turn it on, and you can delete it.</Bullet>
              <Bullet>Sharing publishes a frozen snapshot that you preview first. You can replace or revoke the link.</Bullet>
            </ul>
            <Link href="/privacy" className="group mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Read the privacy notes <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </article>
        </Reveal>
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
    <section className="border-y border-border bg-card/40" aria-labelledby="skill-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-28 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow">Portable skill</p>
          <h2 id="skill-title" className="mt-4 font-heading text-4xl leading-[1.05] sm:text-5xl">
            Take the way CLEAR explains <Accent>with you.</Accent>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Export CLEAR&rsquo;s teaching method as an Agent Skill. Choose the learner level, depth, analogies and quizzes, preview every file, and download a ZIP for a compatible AI agent.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Seven files of instructions and examples. No conversations, uploads, learning records or keys.</p>
          <Link href="/skill" className="button-secondary group mt-8 gap-2 !rounded-full !px-6">
            Build your skill <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>
        <Reveal variant="scale" delay={120}>
          <div className="surface-panel overflow-hidden font-mono text-sm shadow-xl" aria-hidden="true">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" />
              <span className="ml-2">clear-explainer.zip</span>
            </div>
            <ul className="space-y-1 p-5">
              <li className="flex items-center gap-2.5 text-foreground"><Folder className="size-4 text-primary" />clear-explainer/</li>
              {SKILL_FILES.map(([name, depth], index) => (
                <li key={name} className="animate-fade-up flex items-center gap-2.5" style={{ paddingLeft: `${depth === 1 ? 2.75 : 1.375}rem`, animationDelay: `${300 + index * 90}ms` } as CSSProperties}>
                  {depth === -1 ? <Folder className="size-4 text-primary" /> : <FileText className="size-4 text-muted-foreground" />}
                  <span className={depth === -1 ? "text-foreground" : "text-muted-foreground"}>{name}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STATS = [
  [10, "views of every lesson", "hue-understand"],
  [5, "model providers", "hue-visual"],
  [7, "trusted interactive widgets", "hue-examples"],
  [0, "model-written scripts run", "hue-verify"],
] as const;

export function StatsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20" aria-label="CLEAR in numbers">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(([value, label, hue], index) => (
          <li key={label}>
            <Reveal delay={index * 90} className="h-full">
              <div className={`${hue} surface-panel h-full p-6 text-center`}>
                <p className="tone-text font-heading text-5xl sm:text-6xl"><CountUp value={value} /></p>
                <p className="mt-2 text-sm text-muted-foreground">{label}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
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
    <section className="mx-auto max-w-3xl px-4 py-20 sm:py-28" aria-labelledby="faq-title">
      <Reveal className="text-center">
        <p className="eyebrow">Questions</p>
        <h2 id="faq-title" className="mt-4 font-heading text-4xl leading-[1.05] sm:text-5xl">Before you ask.</h2>
      </Reveal>
      <Reveal delay={100}>
        <Accordion type="single" collapsible className="surface-panel mt-12 px-5 sm:px-7">
          {FAQ.map(([question, answer], index) => (
            <AccordionItem key={question} value={`faq-${index}`}>
              <AccordionTrigger className="py-5 text-base hover:no-underline sm:text-lg">{question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

export function ClosingSection({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:pb-28" aria-labelledby="closing-title">
      <Reveal variant="scale">
        <div className="surface-panel relative overflow-hidden !rounded-[2rem] px-6 py-16 text-center sm:py-24">
          <div className="aurora" aria-hidden="true" />
          <div className="relative">
            <h2 id="closing-title" className="mx-auto max-w-3xl font-heading text-4xl leading-[1.02] sm:text-6xl">
              What are you trying to <Accent>understand?</Accent>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">Bring the question you have been putting off. It takes about half a minute.</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">{children}</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
