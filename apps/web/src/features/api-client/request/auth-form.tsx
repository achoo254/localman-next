import type { AuthType, RequestAuth } from "@localman/shared/api-client";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Select } from "../../../components/ui/select";
import { useT } from "../../../i18n/i18n-context";
import {
	Field,
	authOf,
	isAuthType,
	isLocation,
	isOffered,
} from "./auth-form-parts";
import { VariableInput } from "./variable-input";

export interface AuthFormProps<A extends RequestAuth> {
	auth: A;
	onChange: (auth: A) => void;
	/** Types offered; a collection has no `inherit`. */
	types: readonly A["type"][];
	/** What `inherit` means here (where the auth comes from). */
	inheritNote: ReactNode;
	disabled?: boolean;
}

/**
 * Auth type and its fields, shared by requests, folders and collections;
 * the header (or query param) is added on send.
 */
export function AuthForm<A extends RequestAuth>({
	auth,
	onChange,
	types,
	inheritNote,
	disabled = false,
}: AuthFormProps<A>) {
	const t = useT();
	const setAuth = (next: RequestAuth) => {
		if (isOffered(next, types)) onChange(next);
	};
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
					disabled={disabled}
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
				<div
					data-id="auth-inherit-source"
					className="flex gap-2 text-muted text-sm"
				>
					<IconInfoCircle size={18} aria-hidden="true" className="shrink-0" />
					<div className="min-w-0">{inheritNote}</div>
				</div>
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
								disabled={disabled}
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
						disabled={disabled}
						value={auth.type}
						onChange={(event) => {
							const type = event.target.value;
							if (isAuthType(type) && type !== auth.type) setAuth(authOf(type));
						}}
					>
						{types.map((type: AuthType) => (
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
