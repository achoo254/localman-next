import { useState } from "react";
import { CodeBlock } from "../../../components/ui/code-block";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { useT } from "../../../i18n/i18n-context";
import {
	CORS_FRAMEWORKS,
	CORS_FRAMEWORK_LABELS,
	type CorsFramework,
	corsSnippet,
} from "./cors-snippets";

/**
 * Third way to reach a local server: let it answer CORS for this page,
 * so the browser sends directly and credentials stay on the machine.
 */
export function CorsHint() {
	const t = useT();
	const [framework, setFramework] = useState<CorsFramework>("express");
	const origin = window.location.origin;
	return (
		<section data-id="tunelo-cors-hint" className="grid gap-2">
			<h3 className="m-0 font-semibold text-sm">
				{t("apiClientTunelo.cors.title")}
			</h3>
			<p className="m-0 text-muted text-xs">
				{t("apiClientTunelo.cors.body", { origin })}
			</p>
			<SegmentedControl
				legend={t("apiClientTunelo.cors.framework")}
				data-id="tunelo-cors-tabs"
				value={framework}
				onChange={setFramework}
				options={CORS_FRAMEWORKS.map((value) => ({
					value,
					label: CORS_FRAMEWORK_LABELS[value],
					"data-id": `tunelo-cors-tab-${value}`,
				}))}
			/>
			<CodeBlock
				caption={CORS_FRAMEWORK_LABELS[framework]}
				code={corsSnippet(framework, origin)}
				data-id="tunelo-cors-snippet"
			/>
		</section>
	);
}
