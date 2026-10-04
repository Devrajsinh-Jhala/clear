import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function DeepDiveView({ document }: { document: ExplanationDocument }) {
  if (document.deepDive.length === 0) {
    return <EmptyCopy>This lesson has no deeper section yet. Ask a follow-up if you want the assumptions and edge cases.</EmptyCopy>;
  }
  return (
    <div className="space-y-6">
      {document.deepDive.map((section) => (
        <section key={section.id}>
          <h2 className="font-serif text-2xl">{section.title}</h2>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap leading-relaxed">{section.body}</p>
        </section>
      ))}
    </div>
  );
}

export function EmptyCopy({ children }: { children: string }) {
  return <p className="max-w-2xl text-muted">{children}</p>;
}
