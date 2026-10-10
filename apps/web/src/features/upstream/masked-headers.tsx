import { isValidHeaderName } from "@localman/shared/api-client";
import { IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { errorMessage } from "../../lib/api-client";
import {
	type TrafficSettings,
	saveRedactHeaders,
} from "./traffic-settings-api";
import { useTrafficSettingsChange } from "./use-traffic-settings";

/** Limits of the server (`redactHeadersSchema`). */
export const MAX_MASKED_HEADERS = 50;
const MAX_HEADER_NAME = 100;

const LIST = "m-0 flex list-none flex-wrap gap-2 p-0";
const CHIP =
	"inline-flex min-h-8 items-center gap-1 rounded-sm border border-border-subtle bg-surface-subtle px-2 font-mono text-[0.8125rem]";

export interface MaskedHeadersProps {
	projectId: string;
	settings: TrafficSettings;
}

/**
 * Headers stored as `[redacted]` in the request log: the fixed defaults,
 * then the project's own names, which the owner adds and removes (each
 * change saves at once).
 */
export function MaskedHeaders({ projectId, settings }: MaskedHeadersProps) {
	const t = useT();
	const toast = useToast();
	const titleId = useId();
	const [name, setName] = useState("");
	const [error, setError] = useState<string | undefined>(undefined);
	const change = useTrafficSettingsChange(projectId, (headers: string[]) =>
		saveRedactHeaders(projectId, headers),
	);
	const custom = settings.redactHeaders;
	const manage = settings.canManage;

	const apply = (headers: string[], done?: () => void) => {
		change.mutate(headers, {
			onSuccess: () => {
				done?.();
				toast.show({ tone: "success", title: t("upstream.masked.saved") });
			},
			onError: (cause) =>
				toast.show({
					tone: "error",
					title: t("upstream.masked.saveFailed"),
					description: errorMessage(cause),
				}),
		});
	};

	const add = () => {
		const value = name.trim().toLowerCase();
		if (value.length > MAX_HEADER_NAME || !isValidHeaderName(value)) {
			setError(t("upstream.masked.invalid"));
		} else if (
			[...settings.defaultRedactedHeaders, ...custom].includes(value)
		) {
			setError(t("upstream.masked.duplicate"));
		} else if (custom.length >= MAX_MASKED_HEADERS) {
			setError(t("upstream.masked.max", { max: MAX_MASKED_HEADERS }));
		} else {
			apply([...custom, value], () => setName(""));
		}
	};

	return (
		<section
			aria-labelledby={titleId}
			data-id="project-detail-masked-headers"
			className="grid gap-3 border-border-subtle border-t pt-6"
		>
			<h3
				id={titleId}
				className="m-0 font-mono font-semibold text-[0.8125rem] text-muted"
			>
				{t("upstream.masked.title")}
			</h3>
			<p className="m-0 text-muted text-sm">
				{renderRich(t("upstream.masked.intro"))}
			</p>
			<p className="m-0 font-semibold text-sm">{t("upstream.masked.always")}</p>
			<ul className={LIST} data-id="project-detail-masked-default">
				{settings.defaultRedactedHeaders.map((header) => (
					<li key={header} className={CHIP}>
						{header}
					</li>
				))}
			</ul>
			<p className="m-0 font-semibold text-sm">{t("upstream.masked.custom")}</p>
			{custom.length === 0 ? (
				<p className="m-0 text-muted text-sm">{t("upstream.masked.none")}</p>
			) : (
				<ul className={LIST} data-id="project-detail-masked-custom">
					{custom.map((header) => (
						<li key={header} className={CHIP}>
							{header}
							{manage ? (
								<IconButton
									size="sm"
									label={t("upstream.masked.remove", { name: header })}
									icon={<IconX size={16} aria-hidden="true" />}
									disabled={change.isPending}
									onClick={() =>
										apply(custom.filter((item) => item !== header))
									}
								/>
							) : null}
						</li>
					))}
				</ul>
			)}
			{manage ? (
				<form
					noValidate
					className="flex flex-wrap items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						add();
					}}
				>
					<FormField
						label={t("upstream.masked.inputLabel")}
						error={error}
						announceError
						className="min-w-0 flex-1 basis-56"
					>
						<Input
							value={name}
							maxLength={MAX_HEADER_NAME}
							placeholder="x-session-token"
							autoComplete="off"
							spellCheck={false}
							onChange={(event) => {
								setName(event.target.value);
								setError(undefined);
							}}
							data-id="project-detail-masked-input"
						/>
					</FormField>
					<Button
						type="submit"
						disabled={change.isPending}
						data-id="project-detail-masked-add"
					>
						{t("upstream.masked.add")}
					</Button>
				</form>
			) : null}
		</section>
	);
}
