import { isLocale } from "@localman/shared/constants";
import { useToast } from "../components/ui/toast";
import { peekCurrentUser } from "../features/auth/use-current-user";
import { useI18n } from "./i18n-context";
import { loadMessages } from "./load-messages";
import { saveUserLocale } from "./save-user-locale";
import { createTranslator } from "./translate";

/**
 * Switches the interface language: remembered in this browser and, for a
 * signed-in user, on the account. Failures are told in a toast. Shared by
 * the top-bar menu and the footer pill.
 */
export function useChooseLocale(): (value: string) => Promise<void> {
	const { locale, setLocale, t } = useI18n();
	const toast = useToast();
	return async (value: string) => {
		if (!isLocale(value) || value === locale) return;
		try {
			await setLocale(value);
		} catch {
			toast.show({ tone: "error", title: t("common.language.loadFailed") });
			return;
		}
		if (peekCurrentUser().status !== "authenticated") return;
		try {
			await saveUserLocale(value);
		} catch {
			// Said in the language just chosen (already loaded, so no fetch).
			const say = await loadMessages(value).then(
				(messages) => createTranslator(value, messages).t,
				() => t,
			);
			toast.show({ tone: "error", title: say("common.language.saveFailed") });
		}
	};
}
