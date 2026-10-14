import { useId } from "react";
import { useT } from "../../i18n/i18n-context";
import type { ShareableEnvironment } from "../sharing/share-people-form";
import { RunButtonCreate } from "./run-button-create";
import { RunButtonList } from "./run-button-list";

/** "Run" tab of the Share dialog: create Run buttons and copy their embed codes. */
export function RunButtonTab({
	collectionId,
	environments,
}: {
	collectionId: string;
	environments: readonly ShareableEnvironment[];
}) {
	const t = useT();
	const titleId = useId();
	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-4"
			data-id="share-run"
		>
			<div className="grid gap-1">
				<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
					{t("publicSharing.share.run.title")}
				</h3>
				<p className="m-0 text-muted text-[0.8125rem]">
					{t("publicSharing.share.run.text")}
				</p>
			</div>
			<RunButtonCreate
				collectionId={collectionId}
				environments={environments}
			/>
			<RunButtonList collectionId={collectionId} environments={environments} />
		</section>
	);
}
