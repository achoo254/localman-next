import { countImportedRequests } from "@localman/shared/api-client";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { cn } from "../../../lib/cn";
import { importErrorText, importWarningText } from "./import-messages";
import type { ImportParse } from "./use-import-source";

export interface ImportDetectionProps {
	id: string;
	parse: ImportParse;
}

/** One live line on what the input is (or why it can't be read), then notes. */
export function ImportDetection({ id, parse }: ImportDetectionProps) {
	const t = useT();
	let line: string;
	let failed = false;
	if (parse.state === "idle") line = t("apiClientTools.import.idle");
	else if (parse.state === "detecting")
		line = t("apiClientTools.import.detecting");
	else if (parse.state === "read-failed") {
		line = t("apiClientTools.import.readFailed");
		failed = true;
	} else if (!parse.result.ok) {
		line = importErrorText(parse.result.error, t);
		failed = true;
	} else {
		const data = parse.result.value;
		line =
			data.format === "environment-v21"
				? t("apiClientTools.import.detectedEnvironment", {
						count: data.variables.length,
					})
				: t("apiClientTools.import.detected", {
						format: t(`apiClientTools.import.formats.${data.format}`),
						count: countImportedRequests(data.items),
					});
	}
	const warnings =
		parse.state === "parsed" && parse.result.ok
			? parse.result.value.warnings
			: [];
	return (
		<div className="grid gap-2">
			<output
				id={id}
				aria-live="polite"
				data-id="modal-import-detect"
				data-state={failed ? "error" : parse.state}
				className={cn("block text-sm", failed ? "text-error" : "text-muted")}
			>
				{line}
			</output>
			{warnings.length > 0 ? (
				<details data-id="modal-import-warnings" className="text-sm">
					<summary className="cursor-pointer font-mono text-warning-text">
						{t("apiClientTools.import.warningsTitle", {
							count: warnings.length,
						})}
					</summary>
					<ul className="mt-2 mb-0 grid max-h-40 gap-1 overflow-y-auto pl-5 text-muted text-xs">
						{warnings.map((warning, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: warnings are a read-only list.
							<li key={index}>
								{warning.path ? (
									<span className="font-mono">{warning.path}: </span>
								) : null}
								{renderRich(importWarningText(warning, t))}
							</li>
						))}
					</ul>
				</details>
			) : null}
		</div>
	);
}
