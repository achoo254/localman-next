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
import { ShowcaseSection } from "./showcase-section";

const MODAL_SIZES: readonly ModalSize[] = ["sm", "md", "lg", "xl"];

export function OverlayShowcase() {
	return (
		<ShowcaseSection
			dataId="primitives-overlays"
			title="Lớp phủ"
			description="Modal 4 cỡ trượt vào từ -20px trong 200ms; menu và tooltip dùng Radix."
		>
			<div className="flex flex-wrap items-center gap-3">
				{MODAL_SIZES.map((size) => (
					<Modal
						key={size}
						size={size}
						title={`Modal cỡ ${size.toUpperCase()}`}
						description="Footer dính đáy, hai cột: huỷ và xác nhận."
						data-id={`primitives-overlays-modal-${size}`}
						trigger={<Button size="sm">Modal {size.toUpperCase()}</Button>}
						footer={
							<ModalFooter>
								<ModalClose asChild>
									<Button>Huỷ</Button>
								</ModalClose>
								<ModalClose asChild>
									<Button variant="primary">Lưu</Button>
								</ModalClose>
							</ModalFooter>
						}
					>
						<FormField label="Tên resource">
							<Input placeholder="vd: users" />
						</FormField>
					</Modal>
				))}
				<DropdownMenu>
					<Tooltip content="Thao tác project">
						<DropdownMenuTrigger asChild>
							<IconButton
								label="Thao tác project"
								icon={<IconDots size={18} aria-hidden="true" />}
								data-id="primitives-overlays-menu"
							/>
						</DropdownMenuTrigger>
					</Tooltip>
					<DropdownMenuContent>
						<DropdownMenuItem
							icon={<IconPencil size={16} aria-hidden="true" />}
						>
							Đổi tên
						</DropdownMenuItem>
						<DropdownMenuItem icon={<IconCopy size={16} aria-hidden="true" />}>
							Nhân bản
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							danger
							icon={<IconTrash size={16} aria-hidden="true" />}
						>
							Xoá project
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</ShowcaseSection>
	);
}
