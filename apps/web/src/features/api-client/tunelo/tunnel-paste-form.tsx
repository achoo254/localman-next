import { type FormEvent, useState } from "react";
import { Button } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { useT } from "../../../i18n/i18n-context";
import { exampleTunnelDomain, tunnelOrigin } from "./tunelo-commands";

export interface TunnelPasteFormProps {
	/** Gets the tunnel's origin once the pasted URL is a Tunelo tunnel. */
	onSubmit: (tunnelUrl: string) => void;
	/** The server's tunnel domains; `null` until the settings load. */
	domains: readonly string[] | null;
	busy?: boolean;
}

/** "Or paste the tunnel URL": checked before anything is saved or sent. */
export function TunnelPasteForm({
	onSubmit,
	domains,
	busy = false,
}: TunnelPasteFormProps) {
	const t = useT();
	const [value, setValue] = useState("");
	const [invalid, setInvalid] = useState(false);
	const noDomains = domains?.length === 0;
	const domain = exampleTunnelDomain(domains ?? []);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!domains) return;
		const origin = tunnelOrigin(value, domains);
		setInvalid(origin === null);
		if (origin) onSubmit(origin);
	};

	return (
		<form data-id="tunelo-paste" className="grid gap-2" onSubmit={submit}>
			<FormField
				label={t("apiClientTunelo.panel.paste")}
				hint={noDomains ? t("apiClientTunelo.form.noDomains") : undefined}
				error={
					invalid
						? t("apiClientTunelo.form.invalidTunnel", { domain })
						: undefined
				}
				announceError
			>
				<Input
					value={value}
					inputMode="url"
					spellCheck={false}
					disabled={noDomains}
					placeholder={t("apiClientTunelo.form.tunnelPlaceholder", { domain })}
					data-id="tunelo-paste-input"
					onChange={(event) => {
						setValue(event.target.value);
						setInvalid(false);
					}}
				/>
			</FormField>
			<div>
				<Button
					type="submit"
					variant="secondary"
					disabled={busy || !domains || noDomains}
					data-id="tunelo-paste-submit"
				>
					{t("apiClientTunelo.panel.pasteSubmit")}
				</Button>
			</div>
		</form>
	);
}
