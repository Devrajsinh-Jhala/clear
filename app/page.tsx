import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { HeroDemo } from "@/components/landing/hero-demo";
import { SampleButton } from "@/components/landing/sample-button";
import { Accent, ClosingSection, FaqSection, ProvidersSection, SkillSection, StatsSection, StepsSection, ViewsSection } from "@/components/landing/sections";

const QUESTIONS = [
  ["Why does virtual memory exist?", "How does a mutex prevent a race condition?", "Explain backpropagation visually.", "What happens during a DNS lookup?", "How does public-key encryption work?", "What is Big-O, intuitively?", "Why is the sky blue but sunsets red?"],
  ["Why do we have seasons?", "How does gradient descent find a minimum?", "What is the difference between a process and a thread?", "Why does compound interest grow so fast?", "How do vaccines train the immune system?", "What does a database transaction guarantee?", "Why can't you divide by zero?"],
];

function askLink(question: string) {
  return `/ask?q=${encodeURIComponent(question)}`;
}

function AskLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/ask" className={`button-primary group !min-h-12 gap-2 !rounded-full !px-7 text-base ${className}`}>
      Ask anything
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden" aria-labelledby="hero-title">
        <div className="aurora" aria-hidden="true" />
        <div className="grid-fade" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 text-center sm:pb-24 sm:pt-24">
          <p className="badge animate-fade-up bg-card/70 backdrop-blur">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            The understanding layer for AI
          </p>
          <h1 id="hero-title" className="mx-auto mt-7 max-w-5xl animate-fade-up font-heading text-[clamp(3.25rem,11vw,7.75rem)] leading-[0.92] tracking-[-0.035em] [animation-delay:80ms]">
            Understand <Accent>anything.</Accent>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl animate-fade-up text-lg leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-xl">
            Ask a difficult question. CLEAR turns it into precise explanations, mental models, diagrams, interactive examples, and questions that make sure it actually clicked.
          </p>
          <div className="mt-10 flex animate-fade-up flex-wrap items-start justify-center gap-3 [animation-delay:240ms]">
            <AskLink />
            <SampleButton className="!min-h-12 !rounded-full !px-6 text-base" />
          </div>
          <p className="mt-5 animate-fade-up text-sm text-muted-foreground [animation-delay:300ms]">Free with Gemini. No sign-in. Or bring your own key.</p>
          <div className="mt-14 animate-fade-up [animation-delay:420ms] sm:mt-20">
            <HeroDemo />
          </div>
          <p className="sr-only">
            The preview above shows one lesson about virtual memory as six views: a one-sentence explanation, an analogy, a diagram, a step-through, a quiz and a teach-it-back check.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-card/40 py-10" aria-label="Example questions">
        <p className="eyebrow text-center">Ask it the way you would ask a person</p>
        <div className="marquee-mask mt-6 space-y-3 overflow-hidden" aria-hidden="true">
          {QUESTIONS.map((row, index) => (
            <div key={row[0]} className="marquee-track flex w-max animate-marquee" style={{ animationDirection: index % 2 ? "reverse" : "normal", animationDuration: `${index % 2 ? 62 : 54}s` }}>
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 gap-3 pr-3">
                  {row.map((question) => (
                    <Link key={question} href={askLink(question)} tabIndex={-1} className="whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                      {question}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <ViewsSection />
      <StepsSection />
      <ProvidersSection />
      <SkillSection />
      <StatsSection />
      <FaqSection />
      <ClosingSection>
        <AskLink />
        <SampleButton className="!min-h-12 !rounded-full !px-6 text-base" />
      </ClosingSection>
    </>
  );
}
