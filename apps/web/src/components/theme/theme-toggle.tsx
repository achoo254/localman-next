import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import {
	type ThemePreference,
	applyThemePreference,
	readThemePreference,
} from "../../lib/theme";

const OPTIONS: ReadonlyArray<{
	value: ThemePreference;
	label: string;
	Icon: typeof IconSun;
}> = [
	{ value: "light", label: "Giao diện sáng", Icon: IconSun },
	{ value: "dark", label: "Giao diện tối", Icon: IconMoon },
	{ value: "system", label: "Theo hệ thống", Icon: IconDeviceDesktop },
];

/** Light / dark / system switch that sets `data-theme` on <html>. */
export function ThemeToggle({ "data-id": dataId }: { "data-id"?: string }) {
	const [preference, setPreference] =
		useState<ThemePreference>(readThemePreference);

	function choose(value: ThemePreference) {
		setPreference(value);
		applyThemePreference(value);
	}

	return (
		<fieldset
			data-id={dataId}
			className="m-0 inline-flex gap-1 rounded-md border border-border bg-surface p-1"
		>
			<legend className="sr-only">Chế độ màu</legend>
			{OPTIONS.map(({ value, label, Icon }) => (
				<button
					key={value}
					type="button"
					aria-label={label}
					aria-pressed={preference === value}
					title={label}
					onClick={() => choose(value)}
					className={cn(
						"inline-flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors",
						preference === value
							? "bg-primary-solid text-on-primary"
							: "text-muted hover:bg-fg/6 hover:text-fg",
					)}
				>
					<Icon size={16} aria-hidden="true" />
				</button>
			))}
		</fieldset>
	);
}
