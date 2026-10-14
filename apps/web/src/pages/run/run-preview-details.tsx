import { useId } from "react";
import { Switch } from "../../components/ui/switch";
import { MarkdownView } from "../../features/collections/markdown-view";
import type { RunButtonPreview } from "../../features/public-sharing/run-buttons-api";
import { useT } from "../../i18n/i18n-context";

/**
 * Step 3: what the button imports (name, description, request count,
 * environment, script places) and whether scripts come along.
 */
export function RunPreviewDetails({
	preview,
	includeScripts,
	onIncludeScripts,
}: {
	preview: RunButtonPreview;
	includeScripts: boolean;
	onIncludeScripts: (include: boolean) => void;
}) {
	const t = useT();
	const titleId = useId();
	const switchId = useId();
	const hintId = useId();
	let environment = t("publicSharing.view.run.noEnvironment");
	if (preview.environmentUnavailable) {
		environment = t("publicSharing.view.run.environmentUnavailable");
	} else if (preview.environmentName) {
		environment = t("publicSharing.view.run.environment", {
			name: preview.environmentName,
		});
	}
	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-4"
			data-id="run-preview"
		>
			<h2 id={titleId} className="m-0 font-mono font-semibold text-sm">
				{t("publicSharing.view.run.previewTitle")}
			</h2>
			{preview.description.trim() !== "" ? (
				<MarkdownView source={preview.description} />
			) : null}
			<ul className="m-0 grid gap-1 pl-5 text-sm">
				<li data-id="run-preview-requests">
					{t("publicSharing.view.run.requests", {
						count: preview.requestCount,
					})}
				</li>
				<li data-id="run-preview-environment">{environment}</li>
			</ul>
			<div className="grid gap-1">
				<h3 className="m-0 font-mono font-semibold text-[0.8125rem] text-muted">
					{t("publicSharing.view.run.scriptsTitle")}
				</h3>
				{preview.scripts.length > 0 ? (
					<ul className="m-0 grid gap-1 pl-5 text-sm" data-id="run-scripts">
						{preview.scripts.map((script, index) => (
							<li
								// A request can hold both phases; paths can repeat.
								key={`${script.path.join("/")}-${script.phase}-${index}`}
								className="break-words"
							>
								{script.path.length > 0
									? script.path.join(" / ")
									: t("publicSharing.warning.root")}{" "}
								<span className="text-muted">
									({t(`publicSharing.view.run.scriptPhase.${script.phase}`)})
								</span>
							</li>
						))}
					</ul>
				) : (
					<p className="m-0 text-muted text-sm">
						{t("publicSharing.view.run.noScripts")}
					</p>
				)}
			</div>
			{preview.scripts.length > 0 ? (
				<div className="flex items-start justify-between gap-4">
					<div className="grid min-w-0 gap-0.5">
						<label htmlFor={switchId} className="font-medium text-sm">
							{t("publicSharing.view.run.includeScripts")}
						</label>
						<span id={hintId} className="text-muted text-[0.8125rem]">
							{t("publicSharing.view.run.includeScriptsHint")}
						</span>
					</div>
					<Switch
						id={switchId}
						checked={includeScripts}
						aria-describedby={hintId}
						data-id="run-include-scripts"
						onCheckedChange={onIncludeScripts}
					/>
				</div>
			) : null}
		</section>
	);
}
