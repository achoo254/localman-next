import {
	ENVIRONMENT_COLORS,
	type EnvironmentColor,
} from "@localman/shared/api-client";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/** Literal classes, so Tailwind finds every one at build time. */
const SWATCH: Record<EnvironmentColor, string> = {
	grey: "bg-viz-grey",
	green: "bg-viz-green",
	blue: "bg-viz-blue",
	cyan: "bg-viz-cyan",
	amber: "bg-viz-amber",
	violet: "bg-viz-violet",
	red: "bg-viz-red",
};

/** The environment's color as a dot (decorative: the name says which one). */
export function ColorDot({
	color,
	className,
}: {
	color: EnvironmentColor;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-block size-2.5 flex-none rounded-full",
				SWATCH[color],
				className,
			)}
		/>
	);
}

export interface ColorMenuProps {
	color: EnvironmentColor;
	disabled: boolean;
	onChange: (color: EnvironmentColor) => void;
}

/** The dot as a button that opens the seven colors (Editors only). */
export function ColorMenu({ color, disabled, onChange }: ColorMenuProps) {
	const t = useT();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				disabled={disabled}
				data-id="environment-header-color"
				aria-label={t("environments.color.change", {
					color: t(`environments.color.names.${color}`),
				})}
				className="grid size-8 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent hover:bg-fg/6 disabled:cursor-default disabled:hover:bg-transparent"
			>
				<ColorDot color={color} className="size-3" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{t("environments.color.label")}</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={color}
					onValueChange={(value) => {
						const next = ENVIRONMENT_COLORS.find((item) => item === value);
						if (next) onChange(next);
					}}
				>
					{ENVIRONMENT_COLORS.map((item) => (
						<DropdownMenuRadioItem key={item} value={item}>
							<ColorDot color={item} />
							{t(`environments.color.names.${item}`)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
