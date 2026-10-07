import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { HeroPrompt } from "@/components/landing/hero-prompt";
import { PointerGlow } from "@/components/landing/pointer-glow";
import { ProductPreview } from "@/components/landing/product-preview";
import { SampleButton } from "@/components/landing/sample-button";
import { ClosingSection, FaqSection, LevelSection, ProvidersSection, SkillSection, StepsSection, ViewsSection } from "@/components/landing/sections";

const EXAMPLES = [
  "Why does virtual memory exist?",
  "How does public-key encryption work?",
  "What does a database transaction guarantee?",
  "How does gradient descent find a minimum?",
];

const order = (index: number) => ({ "--i": index }) as CSSProperties;

function AskLink() {
  return (
    <Link href="/ask" className="button-primary group gap-2 !min-h-11 !px-5">
      Ask a question
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="overflow-hidden border-b border-border" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24">
          <div>
            <p className="eyebrow rise flex items-center gap-2">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Free to use. No sign-in needed.
            </p>
            <h1 id="hero-title" className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              <span className="mask-line"><span style={order(1)}>Understand </span></span>
              <span className="mask-line"><span style={order(2)}><span className="marker marker-load">anything.</span></span></span>
            </h1>
            <p className="rise mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground" style={order(4)}>
              Ask a difficult question. CLEAR turns the answer into one checked explanation, then shows it as a summary, a mental model, a diagram, worked examples and a quiz, so you know it actually clicked.
            </p>
            <div className="rise mt-8 flex flex-wrap items-start gap-3" style={order(6)}>
              <AskLink />
              <SampleButton className="!min-h-11 !px-5" />
            </div>
            <p className="rise mt-4 text-sm text-muted-foreground" style={order(7)}>CLEAR Free runs on Gemini. Or bring your own API key.</p>
            <div className="rise mt-10 max-w-xl border-t border-border pt-6" style={order(9)}>
              <p className="text-sm font-medium">Or start from a question people ask</p>
              <div className="mt-3">
                <HeroPrompt questions={EXAMPLES} />
              </div>
            </div>
          </div>
          <PointerGlow className="relative">
            <div className="dot-grid pointer-events-none absolute -inset-8 [mask-image:radial-gradient(closest-side,black,transparent)]" aria-hidden="true" />
            <div className="dot-spot pointer-events-none absolute -inset-8 [--inset:2rem]" aria-hidden="true" />
            <div className="rise relative" style={{ "--i": 3, animationDuration: "0.9s" } as CSSProperties}>
              <div className="sheet" style={{ "--turn": "-2.4deg", "--tx": "-0.9rem", "--ty": "-0.5rem" } as CSSProperties} aria-hidden="true" />
              <div className="sheet" style={{ "--turn": "1.8deg", "--tx": "0.8rem", "--ty": "0.6rem", "--wait": "0.85s" } as CSSProperties} aria-hidden="true" />
              <div className="relative">
                <ProductPreview />
              </div>
            </div>
            <p className="sr-only">
              The preview shows one lesson about virtual memory as six views: a one-sentence explanation, an analogy, a diagram, a step-through, a quiz and a teach-it-back check.
            </p>
          </PointerGlow>
        </div>
      </section>
      <StepsSection />
      <ViewsSection />
      <LevelSection />
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
