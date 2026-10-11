import {
	IconBraces,
	IconDatabase,
	IconPlus,
	IconStack2,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { FromMockModal } from "../api-client/open-in/from-mock-modal";
import type { CollectionCreator } from "./use-collection-create";

export interface CollectionNewMenuProps {
	creator: CollectionCreator;
	/** Viewers cannot add collections; the button stays, disabled. */
	disabled: boolean;
	disabledReason: string;
}

/** "+" of the Collections head: blank, REST CRUD template, mock project. */
export function CollectionNewMenu({
	creator,
	disabled,
	disabledReason,
}: CollectionNewMenuProps) {
	const t = useT();
	const [fromMockOpen, setFromMockOpen] = useState(false);
	const trigger = useRef<HTMLButtonElement>(null);
	// A blank collection opens in its rename box: focus waits for it there,
	// and comes back here only when creating fails.
	const blankNext = useRef(false);
	const createBlank = async (): Promise<void> => {
		if (!(await creator.blank())) trigger.current?.focus();
	};
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild disabled={disabled}>
					<IconButton
						ref={trigger}
						size="sm"
						data-id="sidebar-collections-new"
						label={t("collections.sidebar.new")}
						title={disabled ? disabledReason : t("collections.sidebar.new")}
						loading={creator.pending}
						icon={<IconPlus size={18} aria-hidden="true" />}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					onCloseAutoFocus={(event) => {
						if (!blankNext.current) return;
						blankNext.current = false;
						event.preventDefault();
						void createBlank();
					}}
				>
					<DropdownMenuItem
						data-id="new-menu-blank"
						icon={<IconStack2 size={16} aria-hidden="true" />}
						onSelect={() => {
							blankNext.current = true;
						}}
					>
						{t("collections.newMenu.blank")}
					</DropdownMenuItem>
					<DropdownMenuItem
						data-id="new-menu-template"
						icon={<IconBraces size={16} aria-hidden="true" />}
						onSelect={() => void creator.template()}
					>
						{t("collections.newMenu.template")}
					</DropdownMenuItem>
					<DropdownMenuItem
						data-id="new-menu-from-mock"
						icon={<IconDatabase size={16} aria-hidden="true" />}
						onSelect={() => setFromMockOpen(true)}
					>
						{t("collections.newMenu.fromMock")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<FromMockModal
				open={fromMockOpen}
				onOpenChange={setFromMockOpen}
				onPick={(projectId, name) => void creator.fromMock(projectId, name)}
				copy={{
					title: t("collections.fromMock.title"),
					intro: t("collections.fromMock.intro", { example: "{{id}}" }),
					submit: t("collections.fromMock.submit"),
				}}
			/>
		</>
	);
}
