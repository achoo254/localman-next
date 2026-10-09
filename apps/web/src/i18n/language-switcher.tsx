import { isLocale } from "@localman/shared/constants";
import { IconChevronDown, IconLanguage } from "@tabler/icons-react";
import { buttonClassName } from "../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useToast } from "../components/ui/toast";
import { peekCurrentUser } from "../features/auth/use-current-user";
import { cn } from "../lib/cn";
import { useI18n } from "./i18n-context";
import { loadMessages } from "./load-messages";
import { LOCALE_NAMES } from "./locale-names";
import { saveUserLocale } from "./save-user-locale";
import { createTranslator } from "./translate";

export interface LanguageSwitcherProps {
	"data-id": string;
	/** Hides the language name below 1024px (top bars); the icon stays. */
	compact?: boolean;
}

/**
 * Menu of the interface languages, each named in itself. The choice is
 * remembered in this browser and, for a signed-in user, on the account.
 */
export function LanguageSwitcher({
	"data-id": dataId,
	compact = false,
}: LanguageSwitcherProps) {
	const { locale, setLocale, t } = useI18n();
	const toast = useToast();
	const current = LOCALE_NAMES[locale];

	async function choose(value: string) {
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
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-id={dataId}
					aria-label={t("common.language.trigger", { language: current })}
					className={cn(
						buttonClassName({ variant: "ghost", size: "sm" }),
						"px-2",
					)}
				>
					<IconLanguage size={16} aria-hidden="true" />
					<span lang={locale} className={cn(compact && "max-lg:hidden")}>
						{current}
					</span>
					<IconChevronDown size={14} aria-hidden="true" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent data-id={`${dataId}-menu`} className="min-w-40">
				<DropdownMenuRadioGroup
					aria-label={t("common.language.label")}
					value={locale}
					onValueChange={(value) => void choose(value)}
				>
					{Object.entries(LOCALE_NAMES).map(([code, name]) => (
						<DropdownMenuRadioItem
							key={code}
							value={code}
							lang={code}
							data-id={`${dataId}-${code}`}
						>
							{name}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
