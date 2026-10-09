import {
	API_KEY_LOCATIONS,
	AUTH_TYPES,
	type ApiKeyLocation,
	type AuthType,
	type RequestAuth,
} from "@localman/shared/api-client";
import { IconInfoCircle } from "@tabler/icons-react";
import { type ReactNode, useId } from "react";
import { Select } from "../../../components/ui/select";
import { useT } from "../../../i18n/i18n-context";
import type { DraftPaneProps } from "./draft-pane";
import { VariableInput } from "./variable-input";

/** Starting values when the user switches to another auth type. */
function authOf(type: AuthType): RequestAuth {
	switch (type) {
		case "inherit":
		case "none":
			return { type };
		case "bearer":
			return { type, token: "" };
		case "basic":
			return { type, username: "", password: "" };
		case "apikey":
			return { type, key: "X-Api-Key", value: "", in: "header" };
	}
}

function isAuthType(value: string): value is AuthType {
	return AUTH_TYPES.some((type) => type === value);
}

function isLocation(value: string): value is ApiKeyLocation {
	return API_KEY_LOCATIONS.some((location) => location === value);
}

function Field({
	label,
	children,
}: { label: string; children: (id: string) => ReactNode }) {
	const id = useId();
	return (
		<div className="grid gap-1">
			<label htmlFor={id} className="font-semibold text-sm">
				{label}
			</label>
			{children(id)}
		</div>
	);
}

/** Authorization of the request; the header (or query param) is added on send. */
export function AuthTab({ draft, update }: DraftPaneProps) {
	const t = useT();
	const { auth } = draft;
	const setAuth = (next: RequestAuth) =>
		update((current) => ({ ...current, auth: next }));
	const text = (
		dataId: string,
		label: string,
		value: string,
		change: (value: string) => void,
		placeholder = "",
	) => (
		<Field label={label}>
			{(id) => (
				<VariableInput
					id={id}
					data-id={dataId}
					value={value}
					placeholder={placeholder}
					onValueChange={change}
				/>
			)}
		</Field>
	);

	let detail: ReactNode;
	switch (auth.type) {
		case "inherit":
			detail = (
				<p
					data-id="auth-inherit-source"
					className="flex gap-2 text-muted text-sm"
				>
					<IconInfoCircle size={18} aria-hidden="true" className="shrink-0" />
					{t("apiClient.auth.inheritNone")}
				</p>
			);
			break;
		case "none":
			detail = (
				<p className="text-muted text-sm">{t("apiClient.auth.noneHint")}</p>
			);
			break;
		case "bearer":
			detail = text(
				"auth-token",
				t("apiClient.auth.token"),
				auth.token,
				(token) => setAuth({ ...auth, token }),
				"{{token}}",
			);
			break;
		case "basic":
			detail = (
				<div className="grid gap-3">
					{text(
						"auth-username",
						t("apiClient.auth.username"),
						auth.username,
						(username) => setAuth({ ...auth, username }),
					)}
					{text(
						"auth-password",
						t("apiClient.auth.password"),
						auth.password,
						(password) => setAuth({ ...auth, password }),
						"{{password}}",
					)}
				</div>
			);
			break;
		case "apikey":
			detail = (
				<div className="grid gap-3">
					{text(
						"auth-key",
						t("apiClient.auth.key"),
						auth.key,
						(key) => setAuth({ ...auth, key }),
						"X-Api-Key",
					)}
					{text(
						"auth-value",
						t("apiClient.auth.value"),
						auth.value,
						(value) => setAuth({ ...auth, value }),
						"{{apiKey}}",
					)}
					<Field label={t("apiClient.auth.addTo")}>
						{(id) => (
							<Select
								id={id}
								data-id="auth-in"
								value={auth.in}
								onChange={(event) => {
									const location = event.target.value;
									if (isLocation(location)) setAuth({ ...auth, in: location });
								}}
							>
								<option value="header">{t("apiClient.auth.in.header")}</option>
								<option value="query">{t("apiClient.auth.in.query")}</option>
							</Select>
						)}
					</Field>
				</div>
			);
			break;
	}

	return (
		<div
			data-id="auth-form"
			className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
		>
			<Field label={t("apiClient.auth.type")}>
				{(id) => (
					<Select
						id={id}
						data-id="auth-type"
						value={auth.type}
						onChange={(event) => {
							const type = event.target.value;
							if (isAuthType(type) && type !== auth.type) setAuth(authOf(type));
						}}
					>
						{AUTH_TYPES.map((type) => (
							<option key={type} value={type}>
								{t(`apiClient.auth.types.${type}`)}
							</option>
						))}
					</Select>
				)}
			</Field>
			<div className="min-w-0">{detail}</div>
		</div>
	);
}
