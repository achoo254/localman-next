import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { CopyField } from "../../components/ui/copy-field";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { type AccessKey, createAccessKey } from "./access-keys-api";
import { publicSharingErrorMessage } from "./public-sharing-errors";
import { PublishConfirm } from "./publish-confirm";
import { accessKeysKey } from "./use-public-sharing";
import { usePublishFlow } from "./use-publish-flow";

/** Matches the API's bound on a key name. */
const NAME_MAX = 100;

/**
 * Create an access key by name: dry run, confirm with the secret warning,
 * then the key appears once in a copy field.
 */
export function AccessKeyCreate({ collectionId }: { collectionId: string }) {
	const t = useT();
	const client = useQueryClient();
	const [name, setName] = useState("");
	const [nameError, setNameError] = useState<string | null>(null);
	const [shownKey, setShownKey] = useState<string | null>(null);
	const flow = usePublishFlow(
		(input: string, dryRun: boolean) =>
			createAccessKey(collectionId, input, dryRun),
		(result) => {
			setShownKey(result.key);
			setName("");
			const created = result.accessKey;
			client.setQueryData<AccessKey[]>(accessKeysKey(collectionId), (keys) =>
				created && keys ? [...keys, created] : keys,
			);
		},
	);

	return (
		<div className="grid gap-3">
			<form
				noValidate
				className="flex flex-wrap items-end gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (name.trim() === "") {
						setNameError(t("publicSharing.share.keys.nameEmpty"));
						return;
					}
					setNameError(null);
					setShownKey(null);
					flow.start(name);
				}}
			>
				<FormField
					label={t("publicSharing.share.keys.name")}
					error={nameError ?? undefined}
					className="min-w-0 flex-1 basis-48"
				>
					<Input
						value={name}
						maxLength={NAME_MAX}
						placeholder={t("publicSharing.share.keys.namePlaceholder")}
						disabled={flow.pending !== null}
						data-id="share-key-name"
						onChange={(event) => setName(event.target.value)}
					/>
				</FormField>
				<Button
					type="submit"
					loading={flow.checking}
					disabled={flow.pending !== null}
					data-id="share-key-create"
				>
					{t("publicSharing.share.keys.create")}
				</Button>
			</form>
			{flow.checkError ? (
				<Alert tone="danger" data-id="share-key-error">
					{publicSharingErrorMessage(flow.checkError, t)}
				</Alert>
			) : null}
			{flow.pending ? (
				<PublishConfirm
					title={t("publicSharing.share.keys.confirmTitle")}
					warnings={flow.pending.warnings}
					confirmLabel={t("publicSharing.share.keys.confirm")}
					busy={flow.publishing}
					error={flow.publishError}
					onConfirm={flow.confirm}
					onCancel={flow.cancel}
					data-id="share-key-confirm"
				/>
			) : null}
			{shownKey ? (
				<div className="grid gap-2" data-id="share-key-new">
					<CopyField
						label={t("publicSharing.share.keys.newKey")}
						value={shownKey}
						itemLabel={t("publicSharing.share.keys.newKeyItem")}
						autoCopy
						data-id="share-key-value"
						copyDataId="share-key-copy"
					/>
					<Alert tone="warning">
						{t("publicSharing.share.keys.newKeyWarning")}
					</Alert>
				</div>
			) : null}
		</div>
	);
}
