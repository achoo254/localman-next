import type { RunButtonVisibility } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import type { ShareableEnvironment } from "../sharing/share-people-form";
import { publicSharingErrorMessage } from "./public-sharing-errors";
import { PublishConfirm } from "./publish-confirm";
import {
	type CreateRunButtonInput,
	type RunButton,
	createRunButton,
} from "./run-buttons-api";
import { runButtonsKey } from "./use-public-sharing";
import { usePublishFlow } from "./use-publish-flow";

export interface RunButtonCreateProps {
	collectionId: string;
	/** Environments of the collection's workspace; empty hides the field. */
	environments: readonly ShareableEnvironment[];
}

/** Visibility, optional environment, then dry run, confirm and create. */
export function RunButtonCreate({
	collectionId,
	environments,
}: RunButtonCreateProps) {
	const t = useT();
	const client = useQueryClient();
	const [visibility, setVisibility] = useState<RunButtonVisibility>("team");
	const [environmentId, setEnvironmentId] = useState("");
	const flow = usePublishFlow(
		(input: CreateRunButtonInput, dryRun: boolean) =>
			createRunButton(collectionId, input, dryRun),
		(result) => {
			const created = result.button;
			client.setQueryData<RunButton[]>(runButtonsKey(collectionId), (list) =>
				created && list ? [created, ...list] : list,
			);
		},
	);
	const locked = flow.pending !== null;

	return (
		<div className="grid gap-3">
			<form
				noValidate
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					flow.start({ visibility, environmentId: environmentId || null });
				}}
			>
				<div className="grid gap-1">
					{/* The fieldset's legend names the group for screen readers. */}
					<span aria-hidden="true" className="font-medium text-sm">
						{t("publicSharing.share.run.visibility")}
					</span>
					<SegmentedControl
						legend={t("publicSharing.share.run.visibility")}
						value={visibility}
						onChange={(next) => {
							if (!locked) setVisibility(next);
						}}
						options={[
							{
								value: "team",
								label: t("publicSharing.share.run.visibilities.team"),
								"data-id": "share-run-visibility-team",
							},
							{
								value: "public",
								label: t("publicSharing.share.run.visibilities.public"),
								"data-id": "share-run-visibility-public",
							},
						]}
						data-id="share-run-visibility"
					/>
					<span className="text-muted text-[0.8125rem]">
						{t(`publicSharing.share.run.visibilityHints.${visibility}`)}
					</span>
				</div>
				{environments.length > 0 ? (
					<FormField
						label={`${t("publicSharing.share.run.environment")} ${t("publicSharing.share.run.environmentOptional")}`}
						hint={t("publicSharing.share.run.environmentHint")}
					>
						<Select
							value={environmentId}
							disabled={locked}
							data-id="share-run-environment"
							onChange={(event) => setEnvironmentId(event.target.value)}
						>
							<option value="">
								{t("publicSharing.share.run.noEnvironment")}
							</option>
							{environments.map((env) => (
								<option key={env.id} value={env.id}>
									{env.name}
								</option>
							))}
						</Select>
					</FormField>
				) : null}
				<Button
					type="submit"
					className="justify-self-start"
					loading={flow.checking}
					disabled={locked}
					data-id="share-run-create"
				>
					{t("publicSharing.share.run.create")}
				</Button>
			</form>
			{flow.checkError ? (
				<Alert tone="danger" data-id="share-run-error">
					{publicSharingErrorMessage(flow.checkError, t)}
				</Alert>
			) : null}
			{flow.pending ? (
				<PublishConfirm
					title={t("publicSharing.share.run.confirmTitle")}
					warnings={flow.pending.warnings}
					confirmLabel={t("publicSharing.share.run.confirm")}
					busy={flow.publishing}
					error={flow.publishError}
					onConfirm={flow.confirm}
					onCancel={flow.cancel}
					data-id="share-run-confirm"
				/>
			) : null}
		</div>
	);
}
