/**
 * Runs API client scripts in a Web Worker, so a slow or hostile script
 * never freezes the page. QuickJS stops a script at its own deadline
 * (`SCRIPT_TIMEOUT_MS`); this host adds a hard one and terminates the
 * worker past it, then starts a fresh worker for the next run. Runs are
 * queued one at a time. Without `Worker` (jsdom tests) the given
 * main-thread runner is used instead.
 */
import { SCRIPT_TIMEOUT_MS } from "@localman/shared/api-client";
import type {
	ScriptErrorCode,
	ScriptRunInput,
	ScriptRunResult,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import { type ScriptJob, isScriptReply } from "./script-messages";

/** The part of `Worker` the host uses (tests pass a fake). */
export interface ScriptWorker {
	postMessage: (message: ScriptJob) => void;
	terminate: () => void;
	addEventListener: (
		type: "message" | "error" | "messageerror",
		listener: (event: Event) => void,
	) => void;
}

export interface ScriptHostOptions {
	/** Runner used where `Worker` does not exist. */
	fallback: () => ScriptRunner;
	createWorker?: () => ScriptWorker;
	/** Time past the QuickJS deadline before the worker is terminated. */
	graceMs?: number;
	/** Extra time for the first run of a worker (WASM download and compile). */
	loadMs?: number;
}

const DEFAULT_GRACE_MS = 2_000;
const DEFAULT_LOAD_MS = 20_000;

function spawnWorker(): ScriptWorker {
	return new Worker(new URL("./script-worker.ts", import.meta.url), {
		type: "module",
		name: "localman-scripts",
	});
}

function stopped(
	input: ScriptRunInput,
	code: ScriptErrorCode,
): ScriptRunResult {
	return {
		request: input.request,
		environment: { ...input.environment },
		variables: { ...input.variables },
		tests: [],
		logs: [],
		logsTruncated: false,
		error: { code, message: `Script worker stopped (${code})` },
	};
}

interface Pending {
	id: number;
	input: ScriptRunInput;
	settle: (result: ScriptRunResult) => void;
}

export function createScriptHost(options: ScriptHostOptions): ScriptRunner {
	if (!options.createWorker && typeof Worker === "undefined") {
		return options.fallback();
	}
	const create = options.createWorker ?? spawnWorker;
	const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
	const loadMs = options.loadMs ?? DEFAULT_LOAD_MS;
	let worker: ScriptWorker | null = null;
	/** The worker answered once: its sandbox is loaded. */
	let warm = false;
	let pending: Pending | null = null;
	let nextId = 1;
	let queue: Promise<unknown> = Promise.resolve();

	const settle = (result: ScriptRunResult): void => {
		const current = pending;
		pending = null;
		current?.settle(result);
	};
	const kill = (code: ScriptErrorCode): void => {
		worker?.terminate();
		worker = null;
		warm = false;
		if (pending) settle(stopped(pending.input, code));
	};
	const ensureWorker = (): ScriptWorker => {
		if (worker) return worker;
		const created = create();
		created.addEventListener("message", (event) => {
			const data: unknown = event instanceof MessageEvent ? event.data : null;
			if (!isScriptReply(data) || data.id !== pending?.id) return;
			warm = true;
			settle(data.result);
		});
		const fail = () => kill(warm ? "SCRIPT_INTERNAL" : "SCRIPT_UNAVAILABLE");
		created.addEventListener("error", fail);
		created.addEventListener("messageerror", fail);
		worker = created;
		return created;
	};

	const runOne = (input: ScriptRunInput): Promise<ScriptRunResult> =>
		new Promise((resolve) => {
			const target = ensureWorker();
			const limit = SCRIPT_TIMEOUT_MS + graceMs + (warm ? 0 : loadMs);
			const timer = setTimeout(() => kill("SCRIPT_TIMEOUT"), limit);
			const id = nextId++;
			pending = {
				id,
				input,
				settle: (result) => {
					clearTimeout(timer);
					resolve(result);
				},
			};
			try {
				target.postMessage({ id, input });
			} catch {
				kill("SCRIPT_INTERNAL");
			}
		});

	return {
		run(input) {
			const result = queue.then(() => runOne(input));
			queue = result.catch(() => undefined);
			return result;
		},
	};
}
