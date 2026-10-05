import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const fixture = path.resolve(process.env.CLEAR_AUTH_UI_DIRECTORY ?? "");
if (path.dirname(fixture) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith("clear-auth-ui-")) {
  throw new Error("The configured auth UI fixture needs its own temporary directory.");
}
mkdirSync(path.join(fixture, "app/auth"), { recursive: true });
mkdirSync(path.join(fixture, "app/library"), { recursive: true });
mkdirSync(path.join(fixture, "components"), { recursive: true });
symlinkSync(path.join(root, "node_modules"), path.join(fixture, "node_modules"), process.platform === "win32" ? "junction" : "dir");
copyFileSync(path.join(root, "src/components/account-form.tsx"), path.join(fixture, "components/account-form.tsx"));
copyFileSync(path.join(root, "components/page-shell.tsx"), path.join(fixture, "components/page-shell.tsx"));
copyFileSync(path.join(root, "app/globals.css"), path.join(fixture, "app/globals.css"));
copyFileSync(path.join(root, "postcss.config.mjs"), path.join(fixture, "postcss.config.mjs"));
const dependencies = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).dependencies;
writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ name: "clear-synthetic-auth-ui", version: "1.0.0", private: true, dependencies: { next: dependencies.next, react: dependencies.react, "react-dom": dependencies["react-dom"] } }));
writeFileSync(path.join(fixture, "next.config.mjs"), `export default { distDir: '.next-auth-ui', outputFileTracingRoot: ${JSON.stringify(fixture)}, turbopack: { root: ${JSON.stringify(fixture)} }, devIndicators: false };`);
writeFileSync(path.join(fixture, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "react-jsx", incremental: true, plugins: [{ name: "next" }] }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next-auth-ui/types/**/*.ts"], exclude: ["node_modules"] }));
writeFileSync(path.join(fixture, "app/layout.tsx"), `import type { CSSProperties, ReactNode } from 'react';
import './globals.css';
export const metadata = { title: 'Synthetic CLEAR auth UI fixture' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ '--font-geist-sans': 'Arial', '--font-newsreader': 'Georgia', '--font-geist-mono': 'monospace' } as CSSProperties}><main>{children}</main></body></html>;
}`);
writeFileSync(path.join(fixture, "app/auth/page.tsx"), `import { AccountForm } from '../../components/account-form';
import { PageShell } from '../../components/page-shell';
export default function Page() { return <PageShell title="Your CLEAR account" lede="Synthetic UI fixture; no authentication session is created."><AccountForm configured={true} signedIn={false} accountEmail={null} /></PageShell>; }`);
writeFileSync(path.join(fixture, "app/library/page.tsx"), `export default function Page() { return <h1>Synthetic library navigation</h1>; }`);
writeFileSync(path.join(fixture, "app/page.tsx"), `export default function Page() { return <h1>Synthetic home navigation</h1>; }`);

// Only the copied client form is under test: no Supabase, provider, monitoring,
// environment files, private records, or production runtime modules are loaded.
const next = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", fixture, "--webpack", "--hostname", "127.0.0.1", "--port", "3102"], { cwd: fixture, env: process.env, stdio: "inherit", windowsHide: true });
process.on("SIGINT", () => next.kill("SIGTERM"));
process.on("SIGTERM", () => next.kill("SIGTERM"));
next.on("error", () => { process.exitCode = 1; });
next.on("exit", (code) => { process.exitCode = code ?? 0; });
