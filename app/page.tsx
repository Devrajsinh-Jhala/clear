import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProductPreview } from "@/components/landing/product-preview";
import { SampleButton } from "@/components/landing/sample-button";
import { ClosingSection, FaqSection, ProvidersSection, SkillSection, StepsSection, ViewsSection } from "@/components/landing/sections";

const EXAMPLES = [
  "Why does virtual memory exist?",
  "How does public-key encryption work?",
  "What does a database transaction guarantee?",
  "How does gradient descent find a minimum?",
];

function AskLink() {
  return (
    <Link href="/ask" className="button-primary gap-2 !min-h-11 !px-5">
      Ask a question
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="overflow-hidden border-b border-border" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24">
          <div>
            <p className="eyebrow">Free to use. No sign-in needed.</p>
            <h1 id="hero-title" className="mt-4 text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl">
              Understand anything.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Ask a difficult question. CLEAR turns the answer into one checked explanation, then shows it as a summary, a mental model, a diagram, worked examples and a quiz, so you know it actually clicked.
            </p>
            <div className="mt-8 flex flex-wrap items-start gap-3">
              <AskLink />
              <SampleButton className="!min-h-11 !px-5" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">CLEAR Free runs on Gemini. Or bring your own API key.</p>
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-sm font-medium">Try asking</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {EXAMPLES.map((question) => (
                  <li key={question}>
                    <Link href={`/ask?q=${encodeURIComponent(question)}`} className="group inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                      <ArrowRight className="size-3.5 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      {question}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="relative">
            <div className="dot-grid pointer-events-none absolute -inset-8 [mask-image:radial-gradient(closest-side,black,transparent)]" aria-hidden="true" />
            <div className="relative">
              <ProductPreview />
            </div>
            <p className="sr-only">
              The preview shows one lesson about virtual memory as six views: a one-sentence explanation, an analogy, a diagram, a step-through, a quiz and a teach-it-back check.
            </p>
          </div>
        </div>
      </section>
      <StepsSection />
      <ViewsSection />
      <ProvidersSection />
      <SkillSection />
      <FaqSection />
      <ClosingSection>
        <AskLink />
        <SampleButton className="!min-h-11 !px-5" />
      </ClosingSection>
    </>
  );
}
