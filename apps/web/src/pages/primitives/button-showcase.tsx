import { IconDots, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Tooltip } from "../../components/ui/tooltip";
import { useT } from "../../i18n/i18n-context";
import { ShowcaseSection } from "./showcase-section";

export function ButtonShowcase() {
	const t = useT();
	return (
		<ShowcaseSection
			dataId="primitives-buttons"
			title={t("primitives.buttons.title")}
			description={t("primitives.buttons.description")}
		>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="primary"
					leadingIcon={<IconPlus size={16} aria-hidden="true" />}
					data-id="primitives-buttons-primary"
				>
					{t("primitives.buttons.createProject")}
				</Button>
				<Button variant="secondary" data-id="primitives-buttons-secondary">
					{t("common.actions.cancel")}
				</Button>
				<Button variant="ghost" data-id="primitives-buttons-ghost">
					{t("primitives.buttons.seeMore")}
				</Button>
				<Button
					variant="danger"
					leadingIcon={<IconTrash size={16} aria-hidden="true" />}
					data-id="primitives-buttons-danger"
				>
					{t("common.actions.delete")}
				</Button>
				<Button
					variant="primary"
					disabled
					data-id="primitives-buttons-disabled"
				>
					{t("primitives.buttons.locked")}
				</Button>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button size="sm" variant="primary" data-id="primitives-buttons-small">
					{t("primitives.buttons.small")}
				</Button>
				<Button size="sm">{t("primitives.buttons.smallSecondary")}</Button>
				<Tooltip content={t("primitives.buttons.moreActions")}>
					<IconButton
						label={t("primitives.buttons.moreActions")}
						icon={<IconDots size={18} aria-hidden="true" />}
						data-id="primitives-buttons-icon"
					/>
				</Tooltip>
			</div>
		</ShowcaseSection>
	);
}
