import { AskComposer } from "@/components/ask/AskComposer";
import { defaultClearFreeModel } from "@/src/lib/ai/models";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:py-20">
      <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <section className="pt-2 lg:pt-8" aria-labelledby="home-title">
          <p className="eyebrow">The understanding workspace</p>
          <h1 id="home-title" className="mt-5 max-w-lg font-serif text-6xl leading-[0.96] tracking-[-0.04em] sm:text-7xl lg:text-[5.5rem]">
            Understand<br />anything.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            AI knows the answer. CLEAR helps you understand it.
          </p>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted">
            Bring a difficult question, a piece of code, or a document. Build a mental model, explore examples, and check what clicked.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
            <span className="badge">CLEAR Free or your own model</span>
            <span>No sign-in required</span>
          </div>
          <div className="mt-10 hidden max-w-sm border-t border-line pt-6 lg:block">
            <p className="font-serif text-xl">One idea, connected views.</p>
            <p className="mt-2 text-sm leading-6 text-muted">Read the explanation. See the mechanism. Try it yourself. Each view builds on the same lesson.</p>
          </div>
        </section>
        <AskComposer defaultModel={defaultClearFreeModel()} />
      </div>
      <section className="mt-14 border-t border-line pt-8 sm:mt-16 sm:pt-10" aria-labelledby="learning-path-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <h2 id="learning-path-title" className="font-serif text-3xl tracking-tight">Go beyond the first answer.</h2>
          <p className="text-sm text-muted">From explanation to understanding</p>
        </div>
        <div className="grid gap-7 sm:grid-cols-3 sm:gap-8">
          <div className="flex gap-4">
            <span className="pt-1 font-mono text-xs text-accent" aria-hidden="true">01</span>
            <div>
              <h3 className="font-serif text-xl">Build the mental model</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Plain language and labeled analogies make the mechanism easier to hold in your head.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="pt-1 font-mono text-xs text-accent" aria-hidden="true">02</span>
            <div>
              <h3 className="font-serif text-xl">Look from another angle</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Worked examples, diagrams, and interactive views connect back to the same explanation.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="pt-1 font-mono text-xs text-accent" aria-hidden="true">03</span>
            <div>
              <h3 className="font-serif text-xl">Find what still needs work</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Check your recall with a quiz, teach it back, or ask a follow-up where the idea feels unclear.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
