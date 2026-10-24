import { IconEye, IconWorld } from "@tabler/icons-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import {
	environmentScope,
	globalsScope,
	openLocalValues,
	useVaultValues,
} from "../secure-vault/vault-codec";
import { ColorDot } from "./environment-color";
import {
	useActiveEnvironment,
	useEnvironment,
	useGlobals,
} from "./use-environments";
import { useOpenVariablesPage } from "./use-open-variables-page";
import { VariablesPaneSection } from "./variables-pane-section";

interface PaneBodyProps {
	workspaceId: string;
	temporary?: ReactNode;
	onOpenPage: () => void;
}

/** The active environment's and the globals' values in use. */
function PaneBody({ workspaceId, temporary, onOpenPage }: PaneBodyProps) {
	const t = useT();
	const active = useActiveEnvironment(workspaceId);
	const environmentId = active.data?.environmentId ?? null;
	const environment = useEnvironment(environmentId);
	const globals = useGlobals(workspaceId);
	const { openEnvironment, openGlobals } = useOpenVariablesPage();
	useVaultValues();
	const shown = environment.data;
	const env = shown
		? {
				...shown,
				localValues: openLocalValues(
					environmentScope(shown.id),
					shown.localValues,
				),
			}
		: undefined;
	const globalsShown = globals.data
		? {
				...globals.data,
				localValues: openLocalValues(
					globalsScope(globals.data.workspaceId),
					globals.data.localValues,
				),
			}
		: undefined;
	return (
		<div className="grid gap-3">
			{temporary}
			<VariablesPaneSection
				data-id="vars-quick-environment"
				title={
					env ? (
						<>
							<ColorDot color={env.color} />
							<span className="truncate">{env.name}</span>
						</>
					) : (
						t("environments.selector.none")
					)
				}
				editId="vars-quick-edit-env"
				editLabel={
					env
						? t("environments.quick.editEnvironment", { name: env.name })
						: undefined
				}
				onEdit={
					env
						? () => {
								openEnvironment(env.id, env.name);
								onOpenPage();
							}
						: undefined
				}
				scope={env}
				failed={active.isError || environment.isError}
				empty={
					active.data && environmentId === null
						? t("environments.quick.noEnvironment")
						: undefined
				}
			/>
			<VariablesPaneSection
				data-id="vars-quick-globals"
				title={
					<>
						<IconWorld
							size={14}
							aria-hidden="true"
							className="text-icon-muted"
						/>
						{t("environments.quick.globals")}
					</>
				}
				editId="vars-quick-edit-globals"
				editLabel={t("environments.quick.editGlobals")}
				onEdit={() => {
					openGlobals(workspaceId);
					onOpenPage();
				}}
				scope={globalsShown}
				failed={globals.isError}
			/>
			<p className="m-0 text-muted text-xs">{t("environments.quick.hint")}</p>
		</div>
	);
}

export interface VariablesPaneProps {
	workspaceId: string;
	/**
	 * Values of the open request's temporary variables, shown first (they
	 * win over every scope). Supplied by the request builder.
	 */
	temporary?: ReactNode;
}

/**
 * Quick look at the variables in use, next to the environment selector:
 * a panel under the eye button that closes on Escape or a click outside.
 * Its data loads only while it is open.
 */
export function VariablesPane({ workspaceId, temporary }: VariablesPaneProps) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const wrapper = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent): void => {
			const target = event.target;
			if (target instanceof Node && wrapper.current?.contains(target)) return;
			setOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [open]);

	return (
		<div
			ref={wrapper}
			className="relative"
			onKeyDown={(event) => {
				if (event.key !== "Escape" || !open) return;
				event.stopPropagation();
				setOpen(false);
				button.current?.focus();
			}}
		>
			<IconButton
				ref={button}
				size="sm"
				data-id="tabbar-vars-quick"
				label={t("environments.quick.open")}
				title={t("environments.quick.open")}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				icon={<IconEye size={16} aria-hidden="true" />}
				onClick={() => setOpen((value) => !value)}
			/>
			{open ? (
				<section
					id={panelId}
					// biome-ignore lint/a11y/useSemanticElements: non-modal panel anchored under its button; a native <dialog> brings centred UA positioning and top-layer rules this popover does not want.
					role="dialog"
					aria-label={t("environments.quick.title")}
					data-id="vars-quick"
					className="absolute top-full right-0 z-50 mt-1 grid max-h-[70vh] w-90 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-md border border-border bg-surface p-3 text-fg shadow-lg"
				>
					<h2 className="m-0 font-bold font-mono text-sm">
						{t("environments.quick.title")}
					</h2>
					<PaneBody
						workspaceId={workspaceId}
						temporary={temporary}
						onOpenPage={() => setOpen(false)}
					/>
				</section>
			) : null}
		</div>
	);
}
