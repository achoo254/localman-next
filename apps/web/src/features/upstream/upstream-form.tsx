import { useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { ApiError, errorMessage } from "../../lib/api-client";
import {
	type ProjectUpstream,
	type TrafficSettings,
	saveUpstream,
	upstreamLabel,
} from "./traffic-settings-api";
import {
	UPSTREAM_KINDS,
	type UpstreamDraft,
	checkUpstream,
	draftOf,
} from "./upstream-form-state";
import { UpstreamOption } from "./upstream-option";
import { UpstreamTunnelFields } from "./upstream-tunnel-fields";
import { useTrafficSettingsChange } from "./use-traffic-settings";

/** Answers of `PUT …/upstream` that are about the URL the user typed. */
const URL_ERROR_CODES = new Set([
	"VALIDATION_ERROR",
	"UPSTREAM_URL_BLOCKED",
	"UPSTREAM_DNS_FAILED",
]);

interface FieldErrors {
	port?: string;
	baseUrl?: string;
}

export interface UpstreamFormProps {
	projectId: string;
	settings: TrafficSettings;
}

/** none / tunnel port / https URL, saved together; read only unless allowed. */
export function UpstreamForm({ projectId, settings }: UpstreamFormProps) {
	const t = useT();
	const toast = useToast();
	const name = useId();
	const [draft, setDraft] = useState<UpstreamDraft>(() =>
		draftOf(settings.upstream),
	);
	const [errors, setErrors] = useState<FieldErrors>({});
	const save = useTrafficSettingsChange(
		projectId,
		(upstream: ProjectUpstream) => saveUpstream(projectId, upstream),
	);
	const manage = settings.canManage;

	const update = (patch: Partial<UpstreamDraft>) => {
		setDraft((previous) => ({ ...previous, ...patch }));
		setErrors({});
	};

	const submit = () => {
		const check = checkUpstream(draft);
		if (!check.ok) {
			setErrors(
				check.field === "port"
					? { port: t("upstream.port.error") }
					: { baseUrl: t("upstream.url.invalid") },
			);
			return;
		}
		save.mutate(check.upstream, {
			onSuccess: (next) => {
				setDraft(draftOf(next.upstream));
				toast.show({
					tone: "success",
					title: renderRich(
						t("upstream.saved", { label: upstreamLabel(next.upstream) }),
					),
				});
			},
			onError: (error) => {
				if (
					check.upstream.kind === "url" &&
					error instanceof ApiError &&
					URL_ERROR_CODES.has(error.code)
				) {
					setErrors({
						baseUrl:
							error.code === "UPSTREAM_URL_BLOCKED"
								? t("upstream.url.blocked")
								: errorMessage(error),
					});
					return;
				}
				toast.show({
					tone: "error",
					title: t("upstream.saveFailed"),
					description: errorMessage(error),
				});
			},
		});
	};

	const fields = {
		none: null,
		tunnel: (
			<UpstreamTunnelFields
				port={draft.port}
				error={errors.port}
				onPortChange={(port) => update({ port })}
				settings={settings}
			/>
		),
		url: (
			<FormField
				label={t("upstream.url.label")}
				error={errors.baseUrl}
				announceError
			>
				<Input
					type="url"
					inputMode="url"
					placeholder="https://staging.example.com"
					value={draft.baseUrl}
					onChange={(event) => update({ baseUrl: event.target.value })}
					data-id="project-detail-upstream-url"
				/>
			</FormField>
		),
	};

	return (
		<form
			noValidate
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<fieldset
				disabled={!manage}
				className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 md:grid-cols-3"
			>
				<legend className="sr-only">{t("upstream.legend")}</legend>
				{UPSTREAM_KINDS.map((kind) => (
					<UpstreamOption
						key={kind}
						kind={kind}
						name={name}
						checked={draft.kind === kind}
						onSelect={(next) => update({ kind: next })}
					>
						{fields[kind]}
					</UpstreamOption>
				))}
			</fieldset>
			<div className="flex flex-wrap items-center gap-3">
				{manage ? (
					<Button
						type="submit"
						variant="primary"
						disabled={save.isPending}
						data-id="project-detail-upstream-save"
					>
						{save.isPending ? t("upstream.saving") : t("upstream.save")}
					</Button>
				) : null}
				<p
					data-id="project-detail-upstream-current"
					className="m-0 min-w-0 text-muted text-sm wrap-anywhere"
				>
					{renderRich(
						t("upstream.current", { label: upstreamLabel(settings.upstream) }),
					)}
				</p>
			</div>
		</form>
	);
}
