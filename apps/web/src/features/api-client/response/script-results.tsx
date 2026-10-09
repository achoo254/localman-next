import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Alert } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { cn } from "../../../lib/cn";
import type { ScriptOutcome } from "../workbench/workbench-types";

const LOG_TONES = {
	log: "text-fg",
	info: "text-info-text",
	warn: "text-warning-text",
	error: "text-error-text",
} as const;

/** Tests tab: `lm.test()` results, script error and console output. */
export function ScriptResultsView({
	results,
}: {
	results: ScriptOutcome | null;
}) {
	const t = useT();
	const tests = results?.tests ?? [];
	const passed = tests.filter((test) => test.passed).length;
	const error = results?.error ?? null;
	// The script's own exception is shown as thrown; a stop by the sandbox
	// (timeout, memory, worker) gets its sentence in the language on screen.
	const message =
		error === null || error.code === "SCRIPT_ERROR"
			? (error?.message ?? "")
			: t(`apiClient.send.script.${error.code}`);
	return (
		<div data-id="response-tests" className="grid content-start gap-3 p-4">
			{error ? (
				<Alert tone="danger" data-id="response-tests-error">
					{error.line
						? t("apiClientTools.response.tests.scriptErrorAt", {
								line: error.line,
								message,
							})
						: t("apiClientTools.response.tests.scriptError", { message })}
				</Alert>
			) : null}
			{tests.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{renderRich(t("apiClientTools.response.tests.none"))}
				</p>
			) : (
				<>
					<p
						data-id="response-tests-summary"
						className="m-0 font-mono font-semibold text-sm"
					>
						{t("apiClientTools.response.tests.summary", {
							passed,
							total: tests.length,
						})}
					</p>
					<ul className="m-0 grid list-none gap-1 p-0">
						{tests.map((test, index) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: test names may repeat.
								key={index}
								data-id="response-test"
								data-passed={test.passed}
								className="flex items-start gap-2 border-border-subtle border-b py-2 text-sm"
							>
								{test.passed ? (
									<IconCircleCheck
										size={18}
										aria-hidden="true"
										className="shrink-0 text-success"
									/>
								) : (
									<IconCircleX
										size={18}
										aria-hidden="true"
										className="shrink-0 text-error"
									/>
								)}
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="font-mono">{test.name}</span>
									{test.error ? (
										<span className="break-all text-muted text-xs">
											{test.error}
										</span>
									) : null}
								</span>
								<Badge tone={test.passed ? "success" : "danger"}>
									{test.passed
										? t("apiClientTools.response.tests.passed")
										: t("apiClientTools.response.tests.failed")}
								</Badge>
							</li>
						))}
					</ul>
				</>
			)}
			<ScriptConsole outcome={results} />
		</div>
	);
}

/** Console output of a script (`console.log` and friends), if any. */
export function ScriptConsole({ outcome }: { outcome: ScriptOutcome | null }) {
	const t = useT();
	const logs = outcome?.logs ?? [];
	if (logs.length === 0) return null;
	return (
		<section className="grid gap-1" data-id="response-script-console">
			<h3 className="m-0 font-mono font-semibold text-muted text-xs">
				{t("apiClientTools.response.tests.console")}
			</h3>
			<pre className="m-0 max-h-60 overflow-auto rounded-md border border-border-subtle bg-surface-subtle p-3 font-mono text-xs">
				{logs.map((entry, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: log lines never reorder.
					<span key={index} className={cn("block", LOG_TONES[entry.level])}>
						{entry.message}
					</span>
				))}
			</pre>
			{outcome?.logsTruncated ? (
				<p className="m-0 text-muted text-xs">
					{t("apiClientTools.response.tests.logsTruncated")}
				</p>
			) : null}
		</section>
	);
}
