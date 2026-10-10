import type {
	ElementRole,
	ShareableElementType,
} from "@localman/shared/access";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { type ShareInput, shareElement } from "./sharing-api";
import { sharingErrorMessage } from "./sharing-errors";
import {
	ELEMENT_ROLE_CHOICES,
	elementAccessKey,
	elementRoleLabel,
} from "./use-element-access";

/** An environment a collection can be shared together with. */
export interface ShareableEnvironment {
	id: string;
	name: string;
}

export interface SharePeopleFormProps {
	elementType: ShareableElementType;
	elementId: string;
	/** Personal workspace or no `manageRoles`: every control is locked. */
	disabled: boolean;
	/** Collections only; the field is hidden while the list is empty. */
	environments: readonly ShareableEnvironment[];
}

/** Share by username or email as Viewer (default) or Editor. */
export function SharePeopleForm({
	elementType,
	elementId,
	disabled,
	environments,
}: SharePeopleFormProps) {
	const t = useT();
	const client = useQueryClient();
	const roleId = useId();
	const [value, setValue] = useState("");
	const [role, setRole] = useState<ElementRole>("viewer");
	const [environmentId, setEnvironmentId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState("");
	const withEnvironment =
		elementType === "collection" && environments.length > 0;

	const share = useMutation({
		mutationFn: (input: ShareInput) =>
			shareElement(elementType, elementId, input),
		onSuccess: (access, input) => {
			client.setQueryData(elementAccessKey(elementType, elementId), access);
			setDone(
				t("sharing.people.shared", {
					who: input.usernameOrEmail,
					role: elementRoleLabel(input.role, t),
				}),
			);
			setValue("");
		},
		onError: (cause) => setError(sharingErrorMessage(cause, t)),
	});

	function submit() {
		const who = value.trim();
		if (who === "") {
			setError(t("sharing.people.empty"));
			return;
		}
		setError(null);
		setDone("");
		share.mutate({
			usernameOrEmail: who,
			role,
			...(withEnvironment && environmentId
				? { includeEnvironmentId: environmentId }
				: {}),
		});
	}

	return (
		<fieldset
			disabled={disabled}
			className="m-0 grid min-w-0 gap-3 border-0 p-0"
		>
			<legend className="sr-only">{t("sharing.people.legend")}</legend>
			<form
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<FormField
					label={t("sharing.people.label")}
					error={error ?? undefined}
					announceError
				>
					<div className="flex flex-wrap gap-2">
						<Input
							value={value}
							placeholder={t("sharing.people.placeholder")}
							autoComplete="off"
							readOnly={share.isPending}
							data-id="share-people-email"
							className="min-w-0 flex-1 basis-48"
							onChange={(event) => {
								setValue(event.target.value);
								setError(null);
							}}
						/>
						<Select
							id={roleId}
							invalid={false}
							aria-label={t("sharing.people.role")}
							value={role}
							data-id="share-people-role"
							className="w-auto"
							onChange={(event) => {
								const next = ELEMENT_ROLE_CHOICES.find(
									(r) => r === event.target.value,
								);
								if (next) setRole(next);
							}}
						>
							{ELEMENT_ROLE_CHOICES.map((choice) => (
								<option key={choice} value={choice}>
									{elementRoleLabel(choice, t)}
								</option>
							))}
						</Select>
						<Button
							type="submit"
							variant="primary"
							className="min-h-11"
							loading={share.isPending}
							data-id="share-people-invite"
						>
							{t("sharing.people.submit")}
						</Button>
					</div>
				</FormField>
			</form>
			{withEnvironment ? (
				<FormField label={t("sharing.people.includeEnv")}>
					<Select
						value={environmentId}
						data-id="share-people-include-env"
						onChange={(event) => setEnvironmentId(event.target.value)}
					>
						<option value="">{t("sharing.people.noEnv")}</option>
						{environments.map((env) => (
							<option key={env.id} value={env.id}>
								{env.name}
							</option>
						))}
					</Select>
				</FormField>
			) : null}
			<output
				aria-live="polite"
				data-id="share-people-match"
				className="text-muted text-[0.8125rem] empty:hidden"
			>
				{done}
			</output>
		</fieldset>
	);
}
