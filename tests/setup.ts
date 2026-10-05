import { vi } from "vitest";

// Server-only marks a Next bundle boundary; unit tests run in a Node server environment.
vi.mock("server-only", () => ({}));
