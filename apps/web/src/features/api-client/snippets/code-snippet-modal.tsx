import {
	type PreparedRequest,
	SNIPPET_TARGETS,
	type SnippetResult,
	type SnippetTarget,
	generateSnippet,
	isSnippetTarget,
} from "@localman/shared/api-client";
import { useMemo, useRef, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { CodeBlock } from "../../../components/ui/code-block";
import { FormField } from "../../../components/ui/form-field";
import { Modal } from "../../../components/ui/modal";
import { Select } from "../../../components/ui/select";
import { useT } from "../../../i18n/i18n-context";
import { SNIPPET_LABELS } from "./snippet-labels";

export interface CodeSnippetModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/**
	 * The request with variables filled in and auth applied (the output of
	 * `prepareRequest`), so the code runs as is.
	 */
	request: PreparedRequest | null;
}

function generate(
	target: SnippetTarget,
	request: PreparedRequest | null,
): SnippetResult | null {
	if (!request) return null;
	try {
		return generateSnippet(target, request);
	} catch {
		return null;
	}
}

const list = (names: readonly string[]): string => names.join(", ");

/** The request as code in one of 16 languages, with a copy button. */
export function CodeSnippetModal({
	open,
	onOpenChange,
	request,
}: CodeSnippetModalProps) {
	const t = useT();
	const [target, setTarget] = useState<SnippetTarget>("curl");
	const select = useRef<HTMLSelectElement>(null);
	const snippet = useMemo(() => generate(target, request), [target, request]);
	const secrets = request?.secretsUsed ?? [];
	const unresolved = request?.unresolved ?? [];

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("apiClientTools.snippet.title")}
			size="lg"
			initialFocusRef={select}
			data-id="modal-code"
		>
			<FormField label={t("apiClientTools.snippet.language")}>
				<Select
					ref={select}
					value={target}
					data-id="modal-code-lang"
					onChange={(event) => {
						const next = event.target.value;
						if (isSnippetTarget(next)) setTarget(next);
					}}
				>
					{SNIPPET_TARGETS.map((id) => (
						<option key={id} value={id}>
							{SNIPPET_LABELS[id]}
						</option>
					))}
				</Select>
			</FormField>
			{snippet ? (
				<CodeBlock
					caption={SNIPPET_LABELS[target]}
					code={snippet.code}
					data-id="modal-code-output"
				/>
			) : (
				<Alert tone="danger" data-id="modal-code-failed">
					{t("apiClientTools.snippet.failed")}
				</Alert>
			)}
			{snippet?.bodyOmitted ? (
				<Alert tone="info">{t("apiClientTools.snippet.bodyOmitted")}</Alert>
			) : null}
			{secrets.length > 0 ? (
				<Alert tone="warning" data-id="modal-code-secrets">
					{t("apiClientTools.snippet.secrets", { names: list(secrets) })}
				</Alert>
			) : null}
			{unresolved.length > 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("apiClientTools.snippet.unresolved", { names: list(unresolved) })}
				</p>
			) : null}
			<p className="m-0 text-muted text-sm">
				{t("apiClientTools.snippet.resolved")}
			</p>
		</Modal>
	);
}
