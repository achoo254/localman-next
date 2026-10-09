import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RouteInfo } from "../workbench/workbench-types";
import { RouteBadge, RouteMark } from "./route-badge";
import { renderClient } from "./routing-test-utils";

const INFO: RouteInfo = {
	why: "direct",
	host: "localhost:3000",
	local: true,
	forbidden: [],
	dropped: [],
};

describe("RouteBadge", () => {
	it("names the route and says why, for screen readers too", () => {
		renderClient(<RouteBadge route="direct" routing={INFO} />);
		const badge = screen.getByText("Direct (localhost)");
		expect(badge).toHaveAttribute("data-route", "direct");
		expect(badge).toHaveTextContent(
			"Sent straight from the browser to localhost:3000 on your network.",
		);
	});

	it("explains a header the browser cannot send", () => {
		renderClient(
			<RouteBadge
				route="tunelo"
				routing={{ ...INFO, why: "forbidden", forbidden: ["Cookie"] }}
			/>,
		);
		expect(screen.getByText("Via Tunelo")).toHaveTextContent(
			"The browser can't set Cookie with fetch, so the request went through your Tunelo tunnel to keep it.",
		);
	});

	it("has a compact mark for history rows", () => {
		renderClient(<RouteMark route="proxy" />);
		expect(screen.getByTitle("Via proxy")).toHaveTextContent("Via proxy");
	});
});
