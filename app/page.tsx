import { AskComposer } from "@/components/ask/AskComposer";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
      <p className="text-sm uppercase tracking-[0.18em] text-accent">AI knows the answer. CLEAR helps you understand it.</p>
      <h1 className="mt-4 max-w-3xl font-serif text-6xl leading-[0.95] sm:text-7xl">Understand anything.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
        Ask a difficult question. CLEAR turns it into precise explanations, mental models, diagrams, interactive examples, and questions that make sure it actually clicked.
      </p>
      <div className="mt-10">
        <AskComposer />
      </div>
      <section className="mt-16 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        <div>
          <h2 className="font-serif text-2xl">One model of the idea</h2>
          <p className="mt-2 text-muted">Text, diagrams, examples, and questions are views of the same explanation, not separate answers.</p>
        </div>
        <div>
          <h2 className="font-serif text-2xl">The model is a detail</h2>
          <p className="mt-2 text-muted">CLEAR Free uses Gemini. Your own keys and other providers stay behind one explanation format.</p>
        </div>
        <div>
          <h2 className="font-serif text-2xl">Analogies stay labeled</h2>
          <p className="mt-2 text-muted">An intuition aid says where it stops being true. The mechanism stays in plain language.</p>
        </div>
      </section>
    </div>
  );
}
