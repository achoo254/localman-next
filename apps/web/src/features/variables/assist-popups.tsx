import type {
	ResolverLayer,
	VariableScopeKind,
} from "@localman/shared/api-client";
import { IconVariablePlus } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { useOpenVariablesPage } from "../environments/use-open-variables-page";
import { FloatingCard } from "./floating-card";
import { SetVariableModal } from "./set-variable-modal";
import type { ApplyVariable } from "./use-apply-variable";
import type { useAssistPopups } from "./use-assist-popups";
import { CONTEXT_SHORTCUT } from "./variable-assist-context";
import { VariableCard } from "./variable-card";
import type { VariableKind } from "./variable-kinds";
import { VariableSuggest } from "./variable-suggest";
import type { ScopeChoice, VariableTargets } from "./variable-targets";

export interface AssistPopupsProps {
	popups: ReturnType<typeof useAssistPopups>;
	layers: readonly ResolverLayer[];
	classify: (name: string) => VariableKind;
	choices: readonly ScopeChoice[];
	targets: VariableTargets;
	apply: ApplyVariable;
}

/** The hover card, `{{` suggestions, "Set as variable" button and modal. */
export function AssistPopups({
	popups,
	layers,
	classify,
	choices,
	targets,
	apply,
}: AssistPopupsProps) {
	const t = useT();
	const { openEnvironment, openGlobals } = useOpenVariablesPage();
	// Where a Viewer sets their own value of a secret hidden from them.
	const openScope = (kind: VariableScopeKind) => {
		const { environment, workspaceId } = targets;
		if (kind === "environment" && environment) {
			openEnvironment(environment.id, environment.name);
		} else if (kind === "global" && workspaceId) openGlobals(workspaceId);
		popups.closeCard();
	};
	const cardRef = useRef<HTMLDivElement>(null);
	const { actions, card, suggest, selection, modalValue } = popups;

	useEffect(() => {
		if (card?.returnTo) cardRef.current?.focus();
	}, [card]);

	// A hover card stays where its variable was: scrolling closes it.
	const { closeCard: dropCard } = popups;
	const hovered = card !== null && card.returnTo === null;
	useEffect(() => {
		if (!hovered) return;
		const close = (event: Event) => {
			const target = event.target;
			if (target instanceof Node && cardRef.current?.contains(target)) return;
			dropCard();
		};
		window.addEventListener("scroll", close, true);
		return () => window.removeEventListener("scroll", close, true);
	}, [hovered, dropCard]);

	const closeCard = (refocus: boolean) => {
		const returnTo = card?.returnTo;
		popups.closeCard();
		if (refocus) returnTo?.focus();
	};

	return (
		<>
			{card ? (
				<FloatingCard
					ref={cardRef}
					anchor={() => card.rect}
					// biome-ignore lint/a11y/useSemanticElements: non-modal card anchored to a variable; a native <dialog> brings centred UA positioning and top-layer rules this card does not want.
					role="dialog"
					aria-label={card.name}
					tabIndex={-1}
					data-id="var-tooltip"
					className="grid w-80 max-w-[calc(100vw-2rem)] gap-2 p-3 focus:outline-none"
					onMouseEnter={popups.keepCard}
					onMouseLeave={(event) => {
						if (!event.currentTarget.contains(document.activeElement)) {
							actions.unhover();
						}
					}}
					onKeyDown={(event) => {
						if (event.key !== "Escape") return;
						event.stopPropagation();
						closeCard(true);
					}}
					onBlur={(event) => {
						const next = event.relatedTarget;
						if (next instanceof Node && event.currentTarget.contains(next)) {
							return;
						}
						closeCard(false);
					}}
				>
					<VariableCard
						name={card.name}
						kind={classify(card.name)}
						layers={layers}
						choices={choices}
						apply={apply}
						openScope={openScope}
						onDone={() => closeCard(true)}
					/>
				</FloatingCard>
			) : null}
			{suggest ? (
				<FloatingCard anchor={suggest.anchor}>
					<VariableSuggest
						listId={suggest.listId}
						items={suggest.items}
						active={suggest.active}
						onPick={popups.pick}
						onHover={popups.hoverAt}
					/>
				</FloatingCard>
			) : null}
			{selection && modalValue === null ? (
				<FloatingCard anchor={selection.anchor} className="p-1">
					<Button
						size="sm"
						variant="ghost"
						data-id="set-as-variable"
						aria-keyshortcuts={CONTEXT_SHORTCUT}
						// Keeps the selection (and focus) in the editor.
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => actions.setAsVariable(selection.text)}
					>
						<IconVariablePlus size={16} aria-hidden="true" />
						{t("variables.set.action")}
					</Button>
				</FloatingCard>
			) : null}
			<SetVariableModal
				value={modalValue}
				choices={choices}
				apply={apply}
				onClose={popups.closeModal}
			/>
		</>
	);
}
