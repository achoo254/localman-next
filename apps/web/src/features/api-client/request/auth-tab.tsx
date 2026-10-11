import { AUTH_TYPES } from "@localman/shared/api-client";
import type { ReactNode } from "react";
import { useT } from "../../../i18n/i18n-context";
import { AuthForm } from "./auth-form";
import type { DraftPaneProps } from "./draft-pane";

export interface AuthTabProps extends DraftPaneProps {
	/** Where `inherit` takes its auth from (a request of a collection). */
	inheritNote?: ReactNode;
}

/** Authorization of the request; the header (or query param) is added on send. */
export function AuthTab({ draft, update, inheritNote }: AuthTabProps) {
	const t = useT();
	return (
		<AuthForm
			auth={draft.auth}
			types={AUTH_TYPES}
			inheritNote={inheritNote ?? t("apiClient.auth.inheritNone")}
			onChange={(auth) => update((current) => ({ ...current, auth }))}
		/>
	);
}
