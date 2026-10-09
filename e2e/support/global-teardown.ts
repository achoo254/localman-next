import { stopStack } from "./stack.js";

/** Stops every process of the stack and its MongoDB, pass or fail. */
export default async function globalTeardown(): Promise<void> {
	await stopStack();
}
