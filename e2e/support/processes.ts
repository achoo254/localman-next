import { type ChildProcessByStdio, spawn } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";

const OUTPUT_LINES = 200;
const STOP_GRACE_MS = 5_000;

/** A child process of the stack, in its own process group. */
export interface Service {
	readonly name: string;
	readonly child: ChildProcessByStdio<null, Readable, Readable>;
	/** Last lines of stdout and stderr, shown when the service fails. */
	readonly output: string[];
}

export interface SpawnOptions {
	readonly cwd: string;
	readonly env: NodeJS.ProcessEnv;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fails when `port` is taken; the owner is for the reader to find (lsof). */
export function assertPortFree(port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once("error", (error: NodeJS.ErrnoException) => {
			reject(
				new Error(
					error.code === "EADDRINUSE"
						? `Port ${port} is busy. Find its owner with \`lsof -i :${port}\`, stop it, then run the E2E again.`
						: error.message,
				),
			);
		});
		probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
	});
}

export function startService(
	name: string,
	command: string,
	args: readonly string[],
	options: SpawnOptions,
): Service {
	// `detached` makes the child a process-group leader, so stopping it also
	// stops what it spawned (tsx starts a Node child of its own).
	const child = spawn(command, args, {
		cwd: options.cwd,
		env: options.env,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const output: string[] = [];
	const keep = (chunk: Buffer): void => {
		output.push(...chunk.toString().split("\n").filter(Boolean));
		output.splice(0, Math.max(0, output.length - OUTPUT_LINES));
	};
	child.stdout.on("data", keep);
	child.stderr.on("data", keep);
	return { name, child, output };
}

function isRunning(service: Service): boolean {
	return service.child.exitCode === null && service.child.signalCode === null;
}

function tail(service: Service): string {
	return service.output.slice(-40).join("\n");
}

/**
 * Resolves when a one-shot service (a build) exits 0; any other exit fails
 * with its output. The caller tracks the service, so a cancelled setup
 * can stop it like the long-running ones.
 */
export function waitForSuccess(service: Service): Promise<void> {
	return new Promise((resolve, reject) => {
		const settle = (code: number | null): void => {
			if (code === 0) resolve();
			else
				reject(
					new Error(`${service.name} failed (exit ${code}):\n${tail(service)}`),
				);
		};
		if (!isRunning(service)) settle(service.child.exitCode);
		else service.child.once("exit", settle);
	});
}

/** Polls `url` until it answers 2xx, failing early if the service exits. */
export async function waitForHttp(
	url: string,
	service: Service,
	timeoutMs = 90_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!isRunning(service)) {
			throw new Error(`${service.name} exited before ready:\n${tail(service)}`);
		}
		try {
			const response = await fetch(url);
			await response.body?.cancel();
			if (response.ok) return;
		} catch {
			// Not listening yet.
		}
		await delay(300);
	}
	throw new Error(`${service.name} not ready at ${url}:\n${tail(service)}`);
}

function signalGroup(service: Service, signal: NodeJS.Signals): void {
	const pid = service.child.pid;
	if (pid === undefined) return;
	try {
		process.kill(-pid, signal);
	} catch (error) {
		// ESRCH: the group is already gone.
		if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
	}
}

/** SIGTERM to the group, SIGKILL after a grace period if it lingers. */
export async function stopService(service: Service): Promise<void> {
	if (!isRunning(service)) return;
	const exited = new Promise<void>((resolve) =>
		service.child.once("exit", () => resolve()),
	);
	signalGroup(service, "SIGTERM");
	let timer: NodeJS.Timeout | undefined;
	const forced = new Promise<void>((resolve) => {
		timer = setTimeout(() => {
			signalGroup(service, "SIGKILL");
			resolve();
		}, STOP_GRACE_MS);
	});
	await Promise.race([exited, forced]);
	clearTimeout(timer);
	await exited;
}

/** Synchronous last resort when the runner exits without a teardown. */
export function killGroupsNow(services: readonly Service[]): void {
	for (const service of services) signalGroup(service, "SIGKILL");
}
