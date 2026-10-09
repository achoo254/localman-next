/**
 * Worker that runs API client scripts in QuickJS, off the page's thread.
 * The sandbox and its WASM load on the first message. One script at a
 * time: `script-host.ts` queues them and terminates this worker when a
 * run overstays its deadline.
 */
import { createScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { type ScriptReply, isScriptJob } from "./script-messages";

const runner = createScriptRunner(
	() => import("@jitl/quickjs-wasmfile-release-sync"),
);

self.addEventListener("message", (event: MessageEvent<unknown>) => {
	const job = event.data;
	if (!isScriptJob(job)) return;
	void runner.run(job.input).then((result) => {
		const reply: ScriptReply = { id: job.id, result };
		// Typed with the DOM lib (no WebWorker lib in this project); a
		// dedicated worker's postMessage takes the same first argument.
		self.postMessage(reply);
	});
});
