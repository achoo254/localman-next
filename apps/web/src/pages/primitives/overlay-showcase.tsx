import { IconCopy, IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { FormField } from "../../components/ui/form-field";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose, type ModalSize } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Tooltip } from "../../components/ui/tooltip";
import { useT } from "../../i18n/i18n-context";
import { ShowcaseSection } from "./showcase-section";

const MODAL_SIZES: readonly ModalSize[] = ["sm", "md", "lg", "xl"];

export function OverlayShowcase() {
	const t = useT();
	return (
		<ShowcaseSection
			dataId="primitives-overlays"
			title={t("primitives.overlays.title")}
			description={t("primitives.overlays.description")}
		>
			<div className="flex flex-wrap items-center gap-3">
				{MODAL_SIZES.map((size) => (
					<Modal
						key={size}
						size={size}
						title={t("primitives.overlays.modalTitle", {
							size: size.toUpperCase(),
						})}
						description={t("primitives.overlays.modalDescription")}
						data-id={`primitives-overlays-modal-${size}`}
						trigger={<Button size="sm">Modal {size.toUpperCase()}</Button>}
						footer={
							<ModalFooter>
								<ModalClose asChild>
									<Button>{t("common.actions.cancel")}</Button>
								</ModalClose>
								<ModalClose asChild>
									<Button variant="primary">{t("common.actions.save")}</Button>
								</ModalClose>
							</ModalFooter>
						}
					>
						<FormField label={t("primitives.overlays.resourceName")}>
							<Input
								placeholder={t("primitives.overlays.resourceNamePlaceholder")}
							/>
						</FormField>
					</Modal>
				))}
				<DropdownMenu>
					<Tooltip content={t("primitives.overlays.projectActions")}>
						<DropdownMenuTrigger asChild>
							<IconButton
								label={t("primitives.overlays.projectActions")}
								icon={<IconDots size={18} aria-hidden="true" />}
								data-id="primitives-overlays-menu"
							/>
						</DropdownMenuTrigger>
					</Tooltip>
					<DropdownMenuContent>
						<DropdownMenuItem
							icon={<IconPencil size={16} aria-hidden="true" />}
						>
							{t("primitives.overlays.rename")}
						</DropdownMenuItem>
						<DropdownMenuItem icon={<IconCopy size={16} aria-hidden="true" />}>
							{t("primitives.overlays.duplicate")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							danger
							icon={<IconTrash size={16} aria-hidden="true" />}
						>
							{t("primitives.overlays.deleteProject")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</ShowcaseSection>
	);
}
