import { IconDots, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Tooltip } from "../../components/ui/tooltip";
import { ShowcaseSection } from "./showcase-section";

export function ButtonShowcase() {
	return (
		<ShowcaseSection
			dataId="primitives-buttons"
			title="Nút"
			description="Bo 12px, phóng 1.03 khi rê chuột và 0.97 khi nhấn, viền focus 2px."
		>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="primary"
					leadingIcon={<IconPlus size={16} aria-hidden="true" />}
					data-id="primitives-buttons-primary"
				>
					Tạo project
				</Button>
				<Button variant="secondary" data-id="primitives-buttons-secondary">
					Huỷ
				</Button>
				<Button variant="ghost" data-id="primitives-buttons-ghost">
					Xem thêm
				</Button>
				<Button
					variant="danger"
					leadingIcon={<IconTrash size={16} aria-hidden="true" />}
					data-id="primitives-buttons-danger"
				>
					Xoá
				</Button>
				<Button
					variant="primary"
					disabled
					data-id="primitives-buttons-disabled"
				>
					Đang khoá
				</Button>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button size="sm" variant="primary" data-id="primitives-buttons-small">
					Nút nhỏ
				</Button>
				<Button size="sm">Nút nhỏ phụ</Button>
				<Tooltip content="Thêm thao tác">
					<IconButton
						label="Thêm thao tác"
						icon={<IconDots size={18} aria-hidden="true" />}
						data-id="primitives-buttons-icon"
					/>
				</Tooltip>
			</div>
		</ShowcaseSection>
	);
}
