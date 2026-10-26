import { TAP_TARGET } from "../components/layout/public-account-slot";
import { cn } from "../lib/cn";
import { useI18n } from "./i18n-context";
import { LOCALE_NAMES } from "./locale-names";
import { useChooseLocale } from "./use-choose-locale";

const OPTION = cn(
	"cursor-pointer rounded-full border border-transparent bg-transparent px-3 py-1 font-mono font-semibold text-[0.8125rem] text-muted hover:text-fg",
	"aria-pressed:border-[color-mix(in_srgb,var(--c-primary)_30%,var(--c-surface))] aria-pressed:bg-[color-mix(in_srgb,var(--c-primary)_8%,var(--c-surface))] aria-pressed:text-primary",
	TAP_TARGET,
);

/**
 * The account app's language pill (auth-next `.lang-switch`): every
 * interface language side by side, each named in itself, the current one
 * tinted. Sits in the footer.
 */
export function LanguagePill({ "data-id": dataId }: { "data-id": string }) {
	const { locale, t } = useI18n();
	const choose = useChooseLocale();
	return (
		<fieldset
			data-id={dataId}
			className="m-0 inline-flex flex-wrap justify-center gap-0.5 rounded-full border border-border bg-surface p-0.5"
		>
			<legend className="sr-only">{t("common.language.label")}</legend>
			{Object.entries(LOCALE_NAMES).map(([code, name]) => (
				<button
					key={code}
					type="button"
					lang={code}
					aria-pressed={code === locale}
					data-id={`${dataId}-${code}`}
					onClick={() => void choose(code)}
					className={OPTION}
				>
					{name}
				</button>
			))}
		</fieldset>
	);
}
