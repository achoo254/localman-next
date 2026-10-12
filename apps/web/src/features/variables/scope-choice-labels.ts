import type { Translate } from "../../i18n/translate";
import type { ScopeChoice } from "./variable-targets";

/** "Environment · Staging", "Globals", "Temporary (this tab)"… */
export function choiceLabel(choice: ScopeChoice, t: Translate): string {
	switch (choice.scope) {
		case "environment":
			return choice.name
				? t("variables.choice.environment", { name: choice.name })
				: t("variables.choice.environmentNone");
		case "collection":
			return choice.name
				? t("variables.choice.collection", { name: choice.name })
				: t("variables.choice.collectionNone");
		case "global":
			return t("variables.choice.global");
		case "temporary":
			return t("variables.choice.temporary");
	}
}

/** Why the scope is closed (shown with it), or its help when it is open. */
export function choiceNote(choice: ScopeChoice, t: Translate): string {
	return choice.blocked
		? t(`variables.choice.blocked.${choice.blocked}`)
		: t(`variables.choice.help.${choice.scope}`);
}

/** The label of a `<select>` option: with the reason when it is closed. */
export function choiceOption(choice: ScopeChoice, t: Translate): string {
	const label = choiceLabel(choice, t);
	return choice.blocked
		? t("variables.choice.option", {
				label,
				reason: t(`variables.choice.blocked.${choice.blocked}`),
			})
		: label;
}
