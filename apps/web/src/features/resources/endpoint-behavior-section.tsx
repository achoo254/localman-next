import { IconArrowsShuffle, IconBolt } from "@tabler/icons-react";
import { useId } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { chaosSummary } from "./behavior-summary";
import { ChaosPanel } from "./chaos-panel";
import { chaosIsOn } from "./endpoint-behavior-draft";
import type {
	BehaviorErrors,
	EndpointDraft,
	EndpointPanel,
} from "./resource-form-state";
import { RulesEditor } from "./rules-editor";

export interface EndpointBehaviorSectionProps {
	endpoint: EndpointDraft;
	/** "GET /users", in accessible names. */
	title: string;
	slug: string;
	errors: BehaviorErrors | undefined;
	onChange: (patch: Partial<EndpointDraft>) => void;
}

const NO_ERRORS: BehaviorErrors = { chaos: {}, rules: {} };

/**
 * Rules and Chaos disclosures of an endpoint card, in the order the mock
 * runs them; one panel open at a time. Saved with the resource form.
 */
export function EndpointBehaviorSection({
	endpoint,
	title,
	slug,
	errors = NO_ERRORS,
	onChange,
}: EndpointBehaviorSectionProps) {
	const t = useT();
	const ids = useId();
	const offId = `${ids}-off`;
	const chaosOn = chaosIsOn(endpoint.chaos);
	const toggle = (panel: Exclude<EndpointPanel, null>) =>
		onChange({ panel: endpoint.panel === panel ? null : panel });
	// An open panel can still be closed on a switched-off endpoint.
	const locked = (panel: EndpointPanel) =>
		!endpoint.enabled && endpoint.panel !== panel;
	const count = endpoint.rules.length;

	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					id={`${ids}-rules`}
					aria-expanded={endpoint.panel === "rules"}
					aria-controls={
						endpoint.panel === "rules" ? `${ids}-rules-panel` : undefined
					}
					aria-label={t("resourceRules.toggleLabel", { endpoint: title })}
					aria-describedby={endpoint.enabled ? undefined : offId}
					title={endpoint.enabled ? undefined : t("resourceChaos.endpointOff")}
					disabled={locked("rules")}
					data-id={`resource-form-endpoint-${slug}-rules`}
					leadingIcon={<IconArrowsShuffle size={16} aria-hidden="true" />}
					onClick={() => toggle("rules")}
				>
					{count > 0
						? t("resourceRules.toggleCount", { count })
						: t("resourceRules.toggle")}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					id={`${ids}-chaos`}
					aria-expanded={endpoint.panel === "chaos"}
					aria-controls={
						endpoint.panel === "chaos" ? `${ids}-chaos-panel` : undefined
					}
					aria-label={t("resourceChaos.toggleLabel", { endpoint: title })}
					aria-describedby={endpoint.enabled ? undefined : offId}
					title={endpoint.enabled ? undefined : t("resourceChaos.endpointOff")}
					disabled={locked("chaos")}
					data-id={`resource-form-endpoint-${slug}-chaos`}
					leadingIcon={<IconBolt size={16} aria-hidden="true" />}
					onClick={() => toggle("chaos")}
				>
					{t("resourceChaos.toggle")}
					{chaosOn ? (
						<Badge tone="warning">{t("resourceChaos.badge")}</Badge>
					) : null}
				</Button>
				{chaosOn && endpoint.panel !== "chaos" ? (
					<span className="font-mono text-muted text-xs">
						{chaosSummary(endpoint.chaos, t)}
					</span>
				) : null}
				{endpoint.enabled ? null : (
					<span id={offId} className="sr-only">
						{t("resourceChaos.endpointOff")}
					</span>
				)}
			</div>
			{endpoint.panel === "rules" ? (
				<RulesEditor
					rules={endpoint.rules}
					onChange={(rules) => onChange({ rules })}
					errors={errors.rules}
					hasBody={endpoint.method === "POST" || endpoint.method === "PUT"}
					slug={slug}
					id={`${ids}-rules-panel`}
					labelledBy={`${ids}-rules`}
				/>
			) : null}
			{endpoint.panel === "chaos" ? (
				<ChaosPanel
					chaos={endpoint.chaos}
					onChange={(chaos) => onChange({ chaos })}
					errors={errors.chaos}
					slug={slug}
					id={`${ids}-chaos-panel`}
					labelledBy={`${ids}-chaos`}
				/>
			) : null}
		</div>
	);
}
