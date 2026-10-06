import { SkillConfigurator } from "@/components/skill/SkillConfigurator";
import { readSkillResources } from "@/src/lib/skill/resources";

export const runtime = "nodejs";

export default async function SkillPage() {
  const resources = await readSkillResources();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <header className="mb-8 max-w-3xl sm:mb-10">
        <p className="eyebrow">Portable skill</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Take understanding with you.</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">The CLEAR way of explaining, ready for your own agent. Choose your teaching style and take it into any topic you want to understand.</p>
      </header>
      <SkillConfigurator resources={resources} />
    </div>
  );
}
