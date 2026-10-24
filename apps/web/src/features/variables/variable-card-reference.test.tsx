import type { KeptResponse } from "@localman/shared/api-client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferenceCard } from "./variable-card-reference";

function kept(body: string): KeptResponse {
	return {
		at: 0,
		response: {
			status: 200,
			statusText: "OK",
			headers: [],
			body,
			bodyEncoding: "utf8",
			size: body.length,
			timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
			finalUrl: "https://api.test/",
			truncated: false,
		},
	};
}

const EXPRESSION = 'response "Log in" "$.token" 60';

describe("the card of a response reference", () => {
	it("names the request, the path and when it is sent again", () => {
		render(<ReferenceCard expression={EXPRESSION} keptFor={() => undefined} />);
		const card = screen
			.getByText("Log in", { selector: "span" })
			.closest("div");
		expect(card?.parentElement).toHaveTextContent("$.token");
		expect(card?.parentElement).toHaveTextContent("older than 60 s");
		expect(screen.getByText(/has not been sent in this tab yet/)).toBeVisible();
	});

	it("shows the value the last response holds at the path", () => {
		render(
			<ReferenceCard
				expression={EXPRESSION}
				keptFor={(name) =>
					name === "Log in" ? kept('{"token":"t-42"}') : undefined
				}
			/>,
		);
		expect(screen.getByText("t-42")).toBeVisible();
	});

	it("says so when the last response has nothing at the path", () => {
		render(
			<ReferenceCard
				expression={EXPRESSION}
				keptFor={() => kept('{"other":1}')}
			/>,
		);
		expect(screen.getByText(/has no value at this path/)).toBeVisible();
	});
});
