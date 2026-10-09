import { useState } from "react";
import { CodeEditor } from "../../../components/ui/code-editor";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { useT } from "../../../i18n/i18n-context";
import type { DraftPaneProps } from "../request/draft-pane";
import { SCRIPT_SNIPPETS, appendSnippet } from "./script-snippets";

type ScriptPhase = "pre" | "post";

/**
 * Pre-request and post-response JavaScript, run in a QuickJS sandbox on
 * send. The sandbox loads only when a script is not empty.
 */
export function ScriptsTab({ draft, update }: DraftPaneProps) {
	const t = useT();
	const [phase, setPhase] = useState<ScriptPhase>("pre");
	const script = draft.scripts[phase];
	const setScript = (text: string) =>
		update((current) =>
			current.scripts[phase] === text
				? current
				: { ...current, scripts: { ...current.scripts, [phase]: text } },
		);

	return (
		<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
			<div className="grid min-w-0 gap-2">
				<SegmentedControl<ScriptPhase>
					legend={t("apiClient.scripts.phase")}
					data-id="request-scripts-phase"
					value={phase}
					onChange={setPhase}
					options={[
						{
							value: "pre",
							label: t("apiClient.scripts.pre"),
							"data-id": "request-scripts-pre",
						},
						{
							value: "post",
							label: t("apiClient.scripts.post"),
							"data-id": "request-scripts-post",
						},
					]}
				/>
				<CodeEditor
					// A new editor per phase keeps undo history apart.
					key={phase}
					value={script}
					language="javascript"
					label={t(
						phase === "pre"
							? "apiClient.scripts.preLabel"
							: "apiClient.scripts.postLabel",
					)}
					placeholder={t("apiClient.scripts.placeholder")}
					lineNumbers
					className="min-h-56"
					data-id="request-scripts-editor"
					onChange={setScript}
				/>
				<p className="text-muted text-xs">
					{phase === "pre"
						? t("apiClient.scripts.preHint", { variable: "{{name}}" })
						: t("apiClient.scripts.postHint")}
				</p>
			</div>
			<section
				aria-labelledby="request-scripts-snippets"
				className="grid content-start gap-1"
			>
				<h3
					id="request-scripts-snippets"
					className="font-semibold text-muted text-xs uppercase"
				>
					{t("apiClient.scripts.snippetsTitle")}
				</h3>
				{SCRIPT_SNIPPETS.map((snippet) => (
					<button
						key={snippet.id}
						type="button"
						data-id="request-scripts-snippet"
						className="min-h-9 cursor-pointer rounded-sm border-0 bg-transparent px-2 py-1 text-left text-muted text-sm transition-colors hover:bg-fg/6 hover:text-fg"
						onClick={() => setScript(appendSnippet(script, snippet.code))}
					>
						{t(`apiClient.scripts.snippets.${snippet.id}`)}
					</button>
				))}
			</section>
		</div>
	);
}
