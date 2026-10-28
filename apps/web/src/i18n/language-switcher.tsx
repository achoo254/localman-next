import { SHELL_LOCALE_NAMES } from "@achoo254/app-shell";
import { IconChevronDown, IconLanguage } from "@tabler/icons-react";
import { buttonClassName } from "../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { cn } from "../lib/cn";
import { LOCALES } from "../lib/shared-preferences";
import { useI18n } from "./i18n-context";
import { useChooseLocale } from "./use-choose-locale";

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
	const { locale, t } = useI18n();
	const choose = useChooseLocale();
	const current = SHELL_LOCALE_NAMES[locale];

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
					{LOCALES.map((code) => (
						<DropdownMenuRadioItem
							key={code}
							value={code}
							lang={code}
							data-id={`${dataId}-${code}`}
						>
							{SHELL_LOCALE_NAMES[code]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
