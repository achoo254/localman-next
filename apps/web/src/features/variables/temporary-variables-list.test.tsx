import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { createTestQueryClient } from "../../test/render-app";
import {
	WorkbenchProvider,
	useWorkbenchActions,
} from "../api-client/workbench/workbench-context";
import {
	echoSender,
	stubClientApi,
} from "../api-client/workbench/workbench-test-utils";
import { TemporaryVariablesList } from "./temporary-variables-list";

afterEach(() => vi.unstubAllGlobals());

/** Opens a tab with two temporary variables. */
function Seed() {
	const { openTab, setTemporaryVariable } = useWorkbenchActions();
	// biome-ignore lint/correctness/useExhaustiveDependencies: seeds once.
	useEffect(() => {
		const id = openTab();
		if (!id) return;
		setTemporaryVariable(id, "token", "abc");
		setTemporaryVariable(id, "userId", "42");
	}, []);
	return null;
}

function renderList(seed: boolean) {
	stubClientApi();
	render(
		<QueryClientProvider client={createTestQueryClient()}>
			<ToastProvider>
				<WorkbenchProvider sender={echoSender()} saveDelayMs={10}>
					{seed ? <Seed /> : null}
					<TemporaryVariablesList />
				</WorkbenchProvider>
			</ToastProvider>
		</QueryClientProvider>,
	);
}

describe("TemporaryVariablesList", () => {
	it("lists the open tab's temporary variables and removes one", async () => {
		const user = userEvent.setup();
		renderList(true);
		const list = await screen.findByRole("list", {
			name: "Temporary variables of this tab",
		});
		expect(list).toHaveTextContent("tokenabc");
		expect(list).toHaveTextContent("userId42");
		await user.click(screen.getByRole("button", { name: "Remove token" }));
		expect(list).not.toHaveTextContent("token");
		expect(list).toHaveTextContent("userId42");
	});

	it("says how to add one when there is none", () => {
		renderList(false);
		expect(
			screen.getByText(/No temporary variables in this tab/),
		).toBeInTheDocument();
	});
});
