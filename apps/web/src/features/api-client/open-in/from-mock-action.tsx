import { IconDatabase } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { FromMockModal } from "./from-mock-modal";
import { useOpenMockRequests } from "./use-open-mock-requests";

/** "From mock project" button of the empty editor, with its dialog. */
export function FromMockAction({ "data-id": dataId }: { "data-id": string }) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const mock = useOpenMockRequests();
	return (
		<>
			<Button
				variant="secondary"
				size="sm"
				data-id={dataId}
				disabled={mock.pending}
				onClick={() => setOpen(true)}
			>
				<IconDatabase size={16} aria-hidden="true" />
				{t("apiClientOpen.fromMock.button")}
			</Button>
			<FromMockModal
				open={open}
				onOpenChange={setOpen}
				onPick={(projectId) => void mock.open({ projectId })}
			/>
		</>
	);
}
