/** Helpers of `auth-form.tsx`: defaults per type, guards and a field. */
import {
	API_KEY_LOCATIONS,
	AUTH_TYPES,
	type ApiKeyLocation,
	type AuthType,
	type RequestAuth,
} from "@localman/shared/api-client";
import { type ReactNode, useId } from "react";

/** Starting values when the user switches to another auth type. */
export function authOf(type: AuthType): RequestAuth {
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

export function isAuthType(value: string): value is AuthType {
	return AUTH_TYPES.some((type) => type === value);
}

export function isOffered<A extends RequestAuth>(
	auth: RequestAuth,
	types: readonly A["type"][],
): auth is A {
	return types.some((type) => type === auth.type);
}

export function isLocation(value: string): value is ApiKeyLocation {
	return API_KEY_LOCATIONS.some((location) => location === value);
}

export function Field({
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
