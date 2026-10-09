import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import {
	type ThemePreference,
	applyThemePreference,
	readThemePreference,
	subscribeThemePreference,
} from "../../lib/theme";

const OPTIONS: ReadonlyArray<{
	value: ThemePreference;
	Icon: typeof IconSun;
}> = [
	{ value: "light", Icon: IconSun },
	{ value: "dark", Icon: IconMoon },
	{ value: "system", Icon: IconDeviceDesktop },
];

/** The prerendered page cannot read storage; it shows "system" first. */
const serverPreference = (): ThemePreference => "system";

/**
 * Light / dark / system switch that sets `data-theme` on <html>. Every
 * switch on the page (top bar, footer) shows the same saved preference.
 */
export function ThemeToggle({ "data-id": dataId }: { "data-id"?: string }) {
	const t = useT();
	const preference = useSyncExternalStore(
		subscribeThemePreference,
		readThemePreference,
		serverPreference,
	);

	return (
		<fieldset
			data-id={dataId}
			className="m-0 inline-flex gap-1 rounded-md border border-border bg-surface p-1"
		>
			<legend className="sr-only">{t("layout.theme.legend")}</legend>
			{OPTIONS.map(({ value, Icon }) => {
				const label = t(`layout.theme.${value}`);
				return (
					<button
						key={value}
						type="button"
						aria-label={label}
						aria-pressed={preference === value}
						title={label}
						onClick={() => applyThemePreference(value)}
						className={cn(
							"inline-flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors",
							preference === value
								? "bg-primary-solid text-on-primary"
								: "text-muted hover:bg-fg/6 hover:text-fg",
						)}
					>
						<Icon size={16} aria-hidden="true" />
					</button>
				);
			})}
		</fieldset>
	);
}
