import { type FormEvent, useState } from "react";
import { Button } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { useT } from "../../../i18n/i18n-context";

/**
 * `host[:port]` as `URL.host` spells it (what the router compares), or
 * `null` for anything with a scheme, path, credentials or spaces.
 */
export function normalizePinnedHost(input: string): string | null {
	const value = input.trim().toLowerCase();
	if (!value || /[\s/?#@\\]/.test(value)) return null;
	try {
		const { host, hostname } = new URL(`http://${value}/`);
		return hostname ? host : null;
	} catch {
		return null;
	}
}

export interface PinnedHostsFormProps {
	/** Shows the host at once; a refused host comes back out with a toast. */
	onAdd: (host: string) => void;
}

/** Adds a host to "Always through the proxy". */
export function PinnedHostsForm({ onAdd }: PinnedHostsFormProps) {
	const t = useT();
	const [value, setValue] = useState("");
	const [invalid, setInvalid] = useState(false);
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const host = normalizePinnedHost(value);
		setInvalid(host === null);
		if (!host) return;
		onAdd(host);
		setValue("");
	};
	return (
		<form
			data-id="settings-routing-host-form"
			className="flex items-end gap-2"
			noValidate
			onSubmit={submit}
		>
			<FormField
				label={t("apiClientRouting.settings.pinned.input")}
				error={
					invalid ? t("apiClientRouting.settings.pinned.invalid") : undefined
				}
				className="min-w-0 flex-1"
			>
				<Input
					value={value}
					spellCheck={false}
					placeholder={t("apiClientRouting.settings.pinned.placeholder")}
					data-id="settings-routing-host-input"
					onChange={(event) => {
						setValue(event.target.value);
						setInvalid(false);
					}}
				/>
			</FormField>
			<Button type="submit" data-id="settings-routing-host-add">
				{t("apiClientRouting.settings.pinned.add")}
			</Button>
		</form>
	);
}
