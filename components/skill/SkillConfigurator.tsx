"use client";

import { useState } from "react";

import { buildSkillFiles, type SkillFile } from "@/src/lib/skill/generate";
import { DEFAULT_SKILL_PREFERENCES, type SkillPreferences } from "@/src/lib/skill/preferences";

const LEVELS = [["beginner", "Beginner"], ["student", "Student"], ["engineer", "Engineer"], ["researcher", "Researcher"], ["interview", "Interview preparation"]] as const;
const DEPTHS = [["quick", "Quick overview"], ["balanced", "Balanced"], ["deep", "Go deep"]] as const;

export function SkillConfigurator({ resources }: { resources: SkillFile[] }) {
  const [preferences, setPreferences] = useState<SkillPreferences>({ ...DEFAULT_SKILL_PREFERENCES });
  const [selectedFile, setSelectedFile] = useState("SKILL.md");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const files = buildSkillFiles(preferences, resources);
  const currentFile = files.find((file) => file.path === selectedFile) ?? files[0];
  const skill = files.find((file) => file.path === "SKILL.md")!;

  function update<K extends keyof SkillPreferences>(key: K, value: SkillPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setCopied(false);
    setCopyError("");
    setDownloaded(false);
    setError("");
  }

  async function copySkill() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(skill.content);
      setCopied(true);
    } catch {
      setCopyError("Copy is unavailable in this browser. Select the text in the SKILL.md preview to copy it.");
      setSelectedFile("SKILL.md");
    }
  }

  async function download() {
    if (pending) return;
    setPending(true);
    setError("");
    setDownloaded(false);
    try {
      const response = await fetch("/api/skills/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "The skill package could not be prepared. Try again.");
      }
      if (!response.headers.get("content-type")?.includes("application/zip")) {
        throw new Error("The download did not arrive as a skill package. Try again.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "clear-explainer.zip";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The download did not finish. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
      <div className="min-w-0 space-y-6">
        <form className="surface-panel p-5 sm:p-7" onSubmit={(event) => { event.preventDefault(); void download(); }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Make it yours</p>
              <h2 className="mt-2 font-serif text-3xl">How do you like to learn?</h2>
            </div>
            <button type="button" disabled={pending} className="shrink-0 text-sm text-muted underline underline-offset-4 disabled:opacity-50" onClick={() => {
              setPreferences({ ...DEFAULT_SKILL_PREFERENCES }); setCopied(false); setCopyError(""); setDownloaded(false); setError("");
            }}>Reset</button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">These become your agent’s starting preferences. You can always ask for something different.</p>
          <fieldset disabled={pending} className="mt-6 space-y-6">
            <legend className="sr-only">Teaching preferences</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium" htmlFor="skill-level">
                <span className="block">Learner level</span>
                <select id="skill-level" value={preferences.level} onChange={(event) => update("level", event.target.value as SkillPreferences["level"])} className="field-control w-full">
                  {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="skill-depth">
                <span className="block">How far to go</span>
                <select id="skill-depth" value={preferences.depth} onChange={(event) => update("depth", event.target.value as SkillPreferences["depth"])} className="field-control w-full">
                  {DEPTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <div className="divide-y divide-line">
              <PreferenceToggle id="skill-analogies" title="Make it familiar" description="Use useful analogies and explain where they stop being true." checked={preferences.analogies === "when-useful"} onChange={(checked) => update("analogies", checked ? "when-useful" : "avoid")} />
              <PreferenceToggle id="skill-visuals" title="Show the connections" description="Include diagrams when structure or flow is easier to see." checked={preferences.visuals === "when-useful"} onChange={(checked) => update("visuals", checked ? "when-useful" : "text-only")} />
              <PreferenceToggle id="skill-quiz" title="Check my understanding" description="Offer a short recall question before revealing the answer." checked={preferences.quiz} onChange={(checked) => update("quiz", checked)} />
              <PreferenceToggle id="skill-interview" title="Practice for interviews" description="Work through reasoning, tradeoffs, and follow-up questions." checked={preferences.interviewMode} onChange={(checked) => update("interviewMode", checked)} />
            </div>
            <label className="block space-y-2 text-sm font-medium" htmlFor="skill-verbosity">
              <span className="block">Writing style</span>
              <select id="skill-verbosity" value={preferences.verbosity} onChange={(event) => update("verbosity", event.target.value as SkillPreferences["verbosity"])} className="field-control w-full">
                <option value="concise">Concise — give each sentence a job</option>
                <option value="detailed">Detailed — include the reasoning</option>
              </select>
            </label>
          </fieldset>
          <div className="mt-7 border-t border-line pt-6">
            <button type="submit" disabled={pending} className="button-primary w-full gap-2">
              <DownloadIcon />{pending ? "Preparing your package…" : error ? "Try download again" : "Download CLEAR skill"}
            </button>
            <p className="mt-3 text-center text-xs text-muted">ZIP · 7 files · No account or API key needed</p>
            {pending ? <p className="mt-3 text-sm text-muted" role="status">Putting your selected preferences into the skill package.</p> : null}
            {downloaded ? <p className="mt-3 text-sm text-accent" role="status">Your package is ready. Check your browser’s downloads.</p> : null}
            {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
          </div>
        </form>
        <section className="rounded-2xl border border-accent/20 bg-accent/5 p-5 sm:p-6">
          <h2 className="font-serif text-2xl">A teaching style, without your history.</h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground">The download includes the CLEAR protocol, three public examples, and the preferences you choose here. Your conversations, documents, learning memory, and provider keys stay out of it.</p>
        </section>
      </div>
      <div className="min-w-0 space-y-6 lg:sticky lg:top-8">
        <section className="surface-panel overflow-hidden" aria-label="Skill package preview">
          <div className="border-b border-line p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="eyebrow">Live preview</p><h2 className="mt-2 font-serif text-3xl">What your agent will read</h2></div>
              <span className="badge">7 files</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{LEVELS.find(([value]) => value === preferences.level)?.[1]} · {DEPTHS.find(([value]) => value === preferences.depth)?.[1]} · {preferences.verbosity === "concise" ? "Concise writing" : "Detailed writing"}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="sr-only" htmlFor="skill-file">Preview file</label>
              <select id="skill-file" value={selectedFile} onChange={(event) => setSelectedFile(event.target.value)} className="field-control min-w-0 flex-1 text-sm">
                {files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
              </select>
              <button type="button" onClick={() => void copySkill()} className="button-secondary text-sm">{copied ? "Copied" : "Copy SKILL.md"}</button>
            </div>
            {copied ? <p className="mt-3 text-xs text-accent" role="status">SKILL.md copied with your current preferences.</p> : null}
            {copyError ? <p className="mt-3 text-xs text-danger" role="alert">{copyError}</p> : null}
          </div>
          <pre aria-label={`${currentFile.path} contents`} tabIndex={0} className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words bg-background/50 p-5 font-mono text-xs leading-6 sm:p-6">{currentFile.content}</pre>
        </section>
        <section className="px-1">
          <h2 className="font-serif text-2xl">Take it into your next conversation.</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            {["Unzip the download. Keep the clear-explainer folder together.", "Add that folder to the skills location supported by your agent.", "Ask your agent to use clear-explainer to help you understand a topic."].map((step, index) => (
              <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-accent">{index + 1}</span><p className="pt-0.5 leading-relaxed">{step}</p></li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-muted">Works with agents that support Agent Skills. The agent supplies its own tools and model; this package carries the teaching instructions.</p>
        </section>
      </div>
    </div>
  );
}

function PreferenceToggle({ id, title, description, checked, onChange }: { id: string; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-4">
    <span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block max-w-sm text-sm leading-relaxed text-muted">{description}</span></span>
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-accent" />
  </label>;
}

function DownloadIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></svg>;
}
