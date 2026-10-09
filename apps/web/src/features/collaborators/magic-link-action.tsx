import { IconCopy, IconLink } from "@tabler/icons-react";
import type { ReactNode, Ref } from "react";
import { Button, type ButtonVariant } from "../../components/ui/button";
import type { MagicLinkStatus } from "./magic-link-api";

export interface MagicLinkActionProps {
	ref: Ref<HTMLButtonElement>;
	/** A link was just created and can be copied. */
	created: boolean;
	/** null while loading or after an error: no action. */
	status: MagicLinkStatus | null;
	creating: boolean;
	onCopy: () => void;
	onCreate: () => void;
	/** Replacing a working link asks first. */
	onRegenerate: () => void;
}

interface ActionSpec {
	label: string;
	variant: ButtonVariant;
	dataId?: string;
	icon?: ReactNode;
	run: () => void;
}

/**
 * Main footer action of the magic link dialog. One button whose label
 * follows the state, so focus stays on it when the state changes.
 */
export function MagicLinkAction({
	ref,
	created,
	status,
	creating,
	onCopy,
	onCreate,
	onRegenerate,
}: MagicLinkActionProps) {
	if (status === null) return null;
	const busyOr = (label: string) => (creating ? "Đang tạo…" : label);
	let spec: ActionSpec;
	if (created) {
		spec = {
			label: "Sao chép link",
			variant: "primary",
			icon: <IconCopy size={16} aria-hidden="true" />,
			run: onCopy,
		};
	} else if (status === "none" || status === "revoked") {
		spec = {
			label: busyOr("Tạo magic link"),
			variant: "primary",
			dataId: "modal-magic-link-create",
			icon: <IconLink size={16} aria-hidden="true" />,
			run: onCreate,
		};
	} else {
		const active = status === "active";
		spec = {
			label: busyOr("Tạo link mới"),
			variant: active ? "secondary" : "primary",
			dataId: "modal-magic-link-regenerate",
			run: active ? onRegenerate : onCreate,
		};
	}
	return (
		<Button
			ref={ref}
			variant={spec.variant}
			data-id={spec.dataId}
			disabled={creating}
			leadingIcon={spec.icon}
			onClick={spec.run}
		>
			{spec.label}
		</Button>
	);
}
