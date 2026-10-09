import {
	type ApiRequestDraft,
	type RequestImportError,
	parseCurlCommand,
} from "@localman/shared/api-client";
import { useRef, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import type { Translate } from "../../../i18n/translate";
import { newId } from "../workbench/workbench-ids";

export interface CurlImportModalProps {
	/** The pasted command; `null` keeps the modal closed. */
	command: string | null;
	onClose: () => void;
	/** Replaces the tab's request with the imported one. */
	onImport: (draft: ApiRequestDraft) => void;
}

function importErrorText(error: RequestImportError, t: Translate): string {
	switch (error.code) {
		case "INPUT_TOO_LARGE":
			return t("apiClient.curl.errors.tooLarge");
		case "UNTERMINATED_QUOTE":
			return t("apiClient.curl.errors.unterminatedQuote");
		default:
			return t("apiClient.curl.errors.invalid");
	}
}

/** Asks before a pasted `curl …` command replaces the request in the tab. */
export function CurlImportModal({
	command,
	onClose,
	onImport,
}: CurlImportModalProps) {
	const t = useT();
	const toast = useToast();
	const cancel = useRef<HTMLButtonElement>(null);
	const [error, setError] = useState<string | null>(null);

	const close = () => {
		setError(null);
		onClose();
	};
	const confirm = () => {
		if (command === null) return;
		const result = parseCurlCommand(command, { newId });
		if (!result.ok) {
			setError(importErrorText(result.error, t));
			return;
		}
		onImport(result.value.draft);
		const warnings = result.value.warnings.length;
		toast.show({
			tone: warnings > 0 ? "info" : "success",
			title: t("apiClient.curl.imported"),
			description:
				warnings > 0
					? t("apiClient.curl.warnings", { count: warnings })
					: undefined,
		});
		close();
	};

	return (
		<Modal
			open={command !== null}
			onOpenChange={(open) => {
				if (!open) close();
			}}
			title={t("apiClient.curl.title")}
			size="md"
			initialFocusRef={cancel}
			data-id="modal-curl-import"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button
							ref={cancel}
							variant="ghost"
							data-id="modal-curl-import-cancel"
						>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button data-id="modal-curl-import-confirm" onClick={confirm}>
						{t("apiClient.curl.confirm")}
					</Button>
				</ModalFooter>
			}
		>
			<p className="text-sm">{t("apiClient.curl.body")}</p>
			<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border-subtle bg-surface-subtle p-3 font-mono text-xs">
				{command}
			</pre>
			{error ? <Alert tone="danger">{error}</Alert> : null}
		</Modal>
	);
}
