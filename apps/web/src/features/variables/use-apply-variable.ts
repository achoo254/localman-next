/**
 * Puts a variable where "Set as variable" or "Add to" chose: the tab for
 * a temporary one, else the shared value of an Editor's scope. Success is
 * a toast; a failure rejects with a message ready to show in the form.
 */
import {
	VARIABLE_KEY_MAX,
	VARIABLE_VALUE_MAX,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { errorMessage } from "../../lib/api-client";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import { choiceLabel } from "./scope-choice-labels";
import {
	type TargetScope,
	type VariableTargets,
	scopeChoices,
} from "./variable-targets";
import {
	type LocalOutcome,
	writeSharedVariable,
} from "./write-shared-variable";

const INVALID_NAME = /[{}\s]/;

/** Why a name cannot be used, or `null` when it can (modal and "Add to"). */
export function nameError(name: string, t: Translate): string | null {
	const key = name.trim();
	if (!key) return t("variables.set.errors.nameRequired");
	if (key.length > VARIABLE_KEY_MAX) {
		return t("variables.set.errors.nameTooLong", { max: VARIABLE_KEY_MAX });
	}
	if (key.startsWith("$") || INVALID_NAME.test(key)) {
		return t("variables.set.errors.nameInvalid");
	}
	return null;
}

export function valueError(value: string, t: Translate): string | null {
	return value.length > VARIABLE_VALUE_MAX
		? t("variables.set.errors.valueTooLong", { max: VARIABLE_VALUE_MAX })
		: null;
}

/** Rejects with an `Error` whose message is ready to show. */
export type ApplyVariable = (
	scope: TargetScope,
	key: string,
	value: string,
) => Promise<void>;

export function useApplyVariable(
	tabId: string,
	targets: VariableTargets,
): ApplyVariable {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { setTemporaryVariable } = useWorkbenchActions();

	return useCallback(
		async (scope, rawKey, value) => {
			const key = rawKey.trim();
			let local: LocalOutcome = "none";
			if (scope === "temporary") {
				setTemporaryVariable(tabId, key, value);
			} else {
				try {
					local = await writeSharedVariable(client, targets, {
						scope,
						key,
						value,
					});
				} catch (error) {
					throw new Error(
						`${t("variables.set.failed")} ${errorMessage(error)}`,
					);
				}
			}
			const choice = scopeChoices(targets).find((item) => item.scope === scope);
			const title = t("variables.set.done", {
				name: key,
				scope: choice ? choiceLabel(choice, t) : scope,
			});
			toast.show(
				local === "kept"
					? {
							tone: "info",
							title,
							description: t("variables.set.localKept", { name: key }),
						}
					: {
							tone: "success",
							title,
							...(local === "reset"
								? { description: t("variables.set.localReset") }
								: {}),
						},
			);
		},
		[tabId, targets, client, setTemporaryVariable, toast, t],
	);
}
