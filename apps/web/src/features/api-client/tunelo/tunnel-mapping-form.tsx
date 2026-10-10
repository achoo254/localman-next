import { localTargetKey } from "@localman/shared/api-client";
import { type FormEvent, useState } from "react";
import { Button } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { useT } from "../../../i18n/i18n-context";
import type { TunnelMapping } from "../routing/client-settings-api";
import { exampleTunnelDomain, tunnelOrigin } from "./tunelo-commands";

export interface TunnelMappingFormProps {
	onSave: (mapping: TunnelMapping) => void;
	busy: boolean;
	/** The server's tunnel domains; `null` until the settings load. */
	domains: readonly string[] | null;
	/** Port of the typed local address (for the `tunelo http` command). */
	onPortChange: (port: number | null) => void;
}

type Field = "local" | "tunnel";

/** A local address and the tunnel URL Tunelo printed for it. */
export function TunnelMappingForm({
	onSave,
	busy,
	domains,
	onPortChange,
}: TunnelMappingFormProps) {
	const t = useT();
	const [local, setLocal] = useState("");
	const [tunnel, setTunnel] = useState("");
	const [errors, setErrors] = useState<ReadonlySet<Field>>(new Set());
	const noDomains = domains?.length === 0;
	const domain = exampleTunnelDomain(domains ?? []);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!domains) return;
		const target = localTargetKey(local.trim());
		const url = tunnelOrigin(tunnel, domains);
		const invalid = new Set<Field>();
		if (!target) invalid.add("local");
		if (!url) invalid.add("tunnel");
		setErrors(invalid);
		if (!target || !url) return;
		onSave({ key: target.key, url, enabled: true });
		setLocal("");
		setTunnel("");
		onPortChange(null);
	};

	return (
		<form
			data-id="tunelo-mapping-form"
			className="grid gap-3"
			noValidate
			onSubmit={submit}
		>
			<h3 className="m-0 font-semibold text-sm">
				{t("apiClientTunelo.form.title")}
			</h3>
			<FormField
				label={t("apiClientTunelo.form.local")}
				error={
					errors.has("local")
						? t("apiClientTunelo.form.invalidLocal")
						: undefined
				}
			>
				<Input
					value={local}
					inputMode="url"
					spellCheck={false}
					placeholder={t("apiClientTunelo.form.localPlaceholder")}
					data-id="tunelo-mapping-local"
					onChange={(event) => {
						setLocal(event.target.value);
						onPortChange(
							localTargetKey(event.target.value.trim())?.port ?? null,
						);
					}}
				/>
			</FormField>
			<FormField
				label={t("apiClientTunelo.form.tunnel")}
				hint={noDomains ? t("apiClientTunelo.form.noDomains") : undefined}
				error={
					errors.has("tunnel")
						? t("apiClientTunelo.form.invalidTunnel", { domain })
						: undefined
				}
			>
				<Input
					value={tunnel}
					inputMode="url"
					spellCheck={false}
					disabled={noDomains}
					placeholder={t("apiClientTunelo.form.tunnelPlaceholder", { domain })}
					data-id="tunelo-mapping-url"
					onChange={(event) => setTunnel(event.target.value)}
				/>
			</FormField>
			<div>
				<Button
					type="submit"
					variant="primary"
					loading={busy}
					disabled={!domains || noDomains}
					data-id="tunelo-mapping-save"
				>
					{t("apiClientTunelo.form.add")}
				</Button>
			</div>
		</form>
	);
}
