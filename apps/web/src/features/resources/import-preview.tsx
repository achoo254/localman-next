import {
	MAX_RECORDS_PER_RESOURCE,
	OBJECT_ID_FIELD,
} from "@localman/shared/constants";
import { useId } from "react";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { ImportNames } from "./import-names";
import { ImportNotes } from "./import-notes";
import { ImportRowsTable, ImportSchemaTable } from "./import-preview-tables";
import type { ImportPreview as Preview } from "./resource-import-api";
import type { PreviewState } from "./use-import-preview";

export interface ImportPreviewProps {
	state: PreviewState;
	/** Edited names by resource `key`. */
	names: Readonly<Record<string, string>>;
	nameErrors: Readonly<Record<string, string>>;
	onRename: (key: string, name: string) => void;
	/** The owner can open the plans; a collaborator can only ask. */
	onManagePlan: (() => void) | null;
}

/** Room left on the owner's plan when the import needs more, else -1. */
export function overPlan(preview: Preview): number {
	const left = preview.resourcesLeft;
	return left !== null && preview.resources.length > left ? left : -1;
}

/**
 * Read-only preview of what the import creates: names (editable), the
 * schema, up to 5 records, then plan room, truncation and notes.
 */
export function ImportPreview({
	state,
	names,
	nameErrors,
	onRename,
	onManagePlan,
}: ImportPreviewProps) {
	const t = useT();
	const titleId = useId();
	const preview =
		state.status === "ready"
			? state.preview
			: state.status === "loading"
				? state.previous
				: null;
	const loading = state.status === "loading";
	const main = preview?.resources[0];
	const fieldCount = main
		? main.fields.length +
			(main.fields.some((f) => f.name === OBJECT_ID_FIELD) ? 0 : 1)
		: 0;
	const fields = t("resourceImport.preview.fields", { count: fieldCount });
	const records = main
		? t("resources.records", { count: main.recordCount })
		: "";
	const left = preview ? overPlan(preview) : -1;
	const caption =
		main?.sampleKind === "generated"
			? t("resourceImport.preview.sample")
			: main && main.recordCount > main.sample.length
				? t("resourceImport.preview.firstRecords", {
						shown: main.sample.length,
						count: main.recordCount,
					})
				: records;

	return (
		<section
			aria-labelledby={titleId}
			aria-busy={loading}
			data-id="resource-import-preview"
			className={cn(
				"grid gap-4 rounded-md border border-border-subtle p-4",
				loading && "opacity-60",
			)}
		>
			<div className="flex flex-wrap items-center gap-2">
				<h3 id={titleId} className="m-0 font-bold font-mono text-sm">
					{t("resourceImport.preview.title")}
				</h3>
				{main ? <Badge>{fields}</Badge> : null}
				{main && main.sampleKind === "source" ? <Badge>{records}</Badge> : null}
			</div>
			{loading ? (
				<p className="m-0 text-muted text-sm">
					{t("resourceImport.preview.loading")}
				</p>
			) : null}
			{!main && !loading ? (
				<p className="m-0 text-muted text-sm">
					{t("resourceImport.preview.empty")}
				</p>
			) : null}
			{main ? (
				<>
					<ImportNames
						resources={preview?.resources ?? []}
						names={names}
						nameErrors={nameErrors}
						onRename={onRename}
					/>
					<h4 className="m-0 font-mono font-semibold text-[0.8125rem]">
						{t("resourceImport.preview.schema")}
					</h4>
					<ImportSchemaTable resource={main} />
					<h4 className="m-0 font-mono font-semibold text-[0.8125rem]">
						{caption}
					</h4>
					{main.sampleKind === "generated" ? (
						<p className="m-0 text-[0.8125rem] text-muted">
							{t("resourceImport.preview.sampleNote")}
						</p>
					) : null}
					{main.sample.length > 0 ? (
						<ImportRowsTable resource={main} caption={caption} />
					) : null}
					{main.truncated ? (
						<Alert tone="warning">
							{t("resourceImport.preview.truncated", {
								max: MAX_RECORDS_PER_RESOURCE,
							})}
						</Alert>
					) : null}
					{left >= 0 && preview ? (
						<Alert tone="warning" data-id="resource-import-plan">
							{t("resourceImport.planRoom", {
								count: preview.resources.length,
								left,
							})}{" "}
							{onManagePlan ? null : t("resourceImport.planRoomCollaborator")}
							{onManagePlan ? (
								<Button size="sm" className="mt-2 flex" onClick={onManagePlan}>
									{t("resourceImport.managePlan")}
								</Button>
							) : null}
						</Alert>
					) : null}
					<ImportNotes notes={preview?.warnings ?? []} />
				</>
			) : null}
			<p aria-live="polite" className="sr-only">
				{state.status === "ready" && main
					? t("resourceImport.preview.ready", { fields, records })
					: ""}
			</p>
		</section>
	);
}
