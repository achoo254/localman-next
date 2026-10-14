import { workspaceRoleAllows } from "@localman/shared/access";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageLoading } from "../../components/layout/page-loading";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FormField } from "../../components/ui/form-field";
import { Select } from "../../components/ui/select";
import { publicSharingErrorMessage } from "../../features/public-sharing/public-sharing-errors";
import { PublicViewError } from "../../features/public-sharing/public-view-error";
import {
	type RunButtonImportInput,
	importRunButton,
} from "../../features/public-sharing/run-buttons-api";
import { useRunButtonPreview } from "../../features/public-sharing/use-public-sharing";
import { useWorkspaces } from "../../features/workspaces/current-workspace";
import { workspaceErrorMessage } from "../../features/workspaces/workspace-errors";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { RunImportDone } from "./run-import-done";
import { RunPreviewDetails } from "./run-preview-details";

/** The target workspace refused (not a member, Viewer, gone) reads as such. */
function importErrorMessage(error: unknown, t: Translate): string {
	if (
		error instanceof ApiError &&
		(error.code === "FORBIDDEN" ||
			(error.status === 404 && error.code !== "RUN_BUTTON_NOT_FOUND"))
	) {
		return t("publicSharing.errors.workspaceUnavailable");
	}
	return publicSharingErrorMessage(error, t);
}

/**
 * Steps 2 to 4 for a signed-in visitor: pick a workspace (Admin or
 * Editor), check what gets imported, import, then open the collection.
 * One idempotency key per page: a second click, or a retry after a lost
 * answer, never imports twice.
 */
export function RunImportFlow({ buttonId }: { buttonId: string }) {
	const t = useT();
	const preview = useRunButtonPreview(buttonId, true);
	const workspaces = useWorkspaces();
	const [idempotencyKey] = useState(() => crypto.randomUUID());
	const inFlight = useRef(false);
	const [workspaceId, setWorkspaceId] = useState("");
	const [includeScripts, setIncludeScripts] = useState<boolean | null>(null);
	const importing = useMutation({
		mutationFn: (input: RunButtonImportInput) => importRunButton(input),
	});

	if (preview.isPending) return <PageLoading />;
	if (preview.error) {
		return (
			<PublicViewError
				error={preview.error}
				onRetry={() => void preview.refetch()}
				notFoundTitle={t("publicSharing.errors.runButtonNotFound")}
			/>
		);
	}
	const details = preview.data;
	if (importing.data) {
		return <RunImportDone name={details.name} result={importing.data} />;
	}
	const eligible = (workspaces.data ?? []).filter((w) =>
		workspaceRoleAllows(w.role, "addElements"),
	);
	const target = eligible.find((w) => w.id === workspaceId) ?? eligible[0];
	const scripts = includeScripts ?? details.visibility === "team";

	function submit() {
		// The ref closes the gap before `isPending` renders (double click).
		if (!target || inFlight.current) return;
		inFlight.current = true;
		importing.mutate(
			{
				buttonId,
				workspaceId: target.id,
				includeScripts: scripts,
				idempotencyKey,
			},
			{
				onSettled: () => {
					inFlight.current = false;
				},
			},
		);
	}

	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="run-import"
				className="mx-auto grid w-full max-w-xl gap-6 p-6 max-sm:p-4"
			>
				<h1 className="m-0 break-words font-bold font-mono text-xl">
					{details.name}
				</h1>
				{workspaces.error ? (
					<Alert tone="danger">
						{workspaceErrorMessage(workspaces.error, t)}
					</Alert>
				) : null}
				{workspaces.data && !target ? (
					<Alert tone="warning" data-id="run-no-workspace">
						{t("publicSharing.view.run.noWorkspace")}
					</Alert>
				) : null}
				{target ? (
					<FormField
						label={t("publicSharing.view.run.workspace")}
						hint={t("publicSharing.view.run.workspaceHint")}
					>
						<Select
							value={target.id}
							disabled={importing.isPending}
							data-id="run-workspace"
							onChange={(event) => setWorkspaceId(event.target.value)}
						>
							{eligible.map((w) => (
								<option key={w.id} value={w.id}>
									{w.name}
								</option>
							))}
						</Select>
					</FormField>
				) : null}
				<RunPreviewDetails
					preview={details}
					includeScripts={scripts}
					onIncludeScripts={setIncludeScripts}
				/>
				{importing.error ? (
					<Alert tone="danger" data-id="run-import-error">
						{importErrorMessage(importing.error, t)}
					</Alert>
				) : null}
				<Button
					variant="primary"
					className="justify-self-start"
					loading={importing.isPending}
					disabled={!target || workspaces.isPending}
					data-id="run-import-submit"
					onClick={submit}
				>
					{t("publicSharing.view.run.import")}
				</Button>
			</Card>
		</div>
	);
}
