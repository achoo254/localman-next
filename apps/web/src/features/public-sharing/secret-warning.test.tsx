import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecretWarning } from "./secret-warning";

describe("SecretWarning", () => {
	it("lists each place by kind, path and name, never a value", () => {
		render(
			<SecretWarning
				warnings={[
					{ where: "collectionVariable", path: [], key: "apiKey" },
					{
						where: "requestHeader",
						path: ["Orders", "List orders"],
						key: "X-Token",
					},
					{ where: "script", path: ["Orders"], key: "pre" },
				]}
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"3 values look like secrets",
		);
		const items = within(
			screen.getByRole("list", {
				name: "Places with secret-looking values",
			}),
		).getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual([
			"Collection variableCollectionapiKey",
			"Request headerOrders / List ordersX-Token",
			"ScriptOrderspre",
		]);
		expect(
			screen.getByText(/Plain variables are published as they are/),
		).toBeInTheDocument();
	});

	it("still says what is published when nothing looks like a secret", () => {
		render(<SecretWarning warnings={[]} />);
		expect(screen.getByRole("status")).toHaveTextContent(
			"No values that look like secrets were found.",
		);
		expect(screen.queryByRole("list")).toBeNull();
		expect(
			screen.getByText(/Plain variables are published as they are/),
		).toBeInTheDocument();
	});
});
