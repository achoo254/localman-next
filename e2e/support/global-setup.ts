import { startStack } from "./stack.js";

/** Playwright runs this once before the specs: the whole E2E stack. */
export default async function globalSetup(): Promise<void> {
	await startStack();
}
