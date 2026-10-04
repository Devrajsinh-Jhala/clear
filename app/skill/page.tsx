import { SkillConfigurator } from "@/components/skill/SkillConfigurator";
import { readSkillResources } from "@/src/lib/skill/resources";

export const runtime = "nodejs";

export default async function SkillPage() {
  const resources = await readSkillResources();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <header className="mb-8 max-w-3xl sm:mb-12">
        <p className="eyebrow">Portable CLEAR</p>
        <h1 className="mt-3 font-serif text-5xl leading-[1.02] sm:text-6xl">Take understanding with you.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">The CLEAR way of explaining, ready for your own agent. Choose your teaching style and take it into any topic you want to understand.</p>
      </header>
      <SkillConfigurator resources={resources} />
    </div>
  );
}
