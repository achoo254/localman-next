import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentType, Suspense, lazy } from "react";
import { Link, Outlet, RouterProvider, createMemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { RouteChunkPending, RouteProgress } from "./route-progress";

const bar = () => document.querySelector('[data-id="route-progress"]');

function Layout() {
	return (
		<>
			<RouteProgress />
			<Link to="/slow">Slow page</Link>
			<Outlet />
		</>
	);
}

describe("RouteProgress", () => {
	it("shows a hidden bar at the top of the window while a navigation is slow", async () => {
		let finish: () => void = () => undefined;
		const router = createMemoryRouter(
			[
				{
					element: <Layout />,
					children: [
						{ path: "/", element: <p>Home</p> },
						{
							path: "/slow",
							loader: () =>
								new Promise<null>((resolve) => {
									finish = () => resolve(null);
								}),
							element: <p>Slow done</p>,
						},
					],
				},
			],
			{ initialEntries: ["/"] },
		);
		render(<RouterProvider router={router} />);
		expect(bar()).toBeNull();
		await userEvent.click(screen.getByRole("link", { name: "Slow page" }));
		await waitFor(() => expect(bar()).not.toBeNull());
		expect(bar()).toHaveAttribute("aria-hidden", "true");
		expect(bar()).toHaveClass("fixed", "top-0", "h-1");
		act(() => finish());
		expect(await screen.findByText("Slow done")).toBeInTheDocument();
		await waitFor(() => expect(bar()).toBeNull());
	});

	it("shows the bar while a lazy page chunk loads, until it arrives", async () => {
		let arrive: () => void = () => undefined;
		const LazyPage = lazy(
			() =>
				new Promise<{ default: ComponentType }>((resolve) => {
					arrive = () => resolve({ default: () => <p>Lazy page</p> });
				}),
		);
		const router = createMemoryRouter([
			{
				element: <Layout />,
				children: [
					{
						path: "/",
						element: (
							<Suspense fallback={<RouteChunkPending />}>
								<LazyPage />
							</Suspense>
						),
					},
				],
			},
		]);
		render(<RouterProvider router={router} />);
		await waitFor(() => expect(bar()).not.toBeNull());
		await act(async () => arrive());
		expect(await screen.findByText("Lazy page")).toBeInTheDocument();
		await waitFor(() => expect(bar()).toBeNull());
	});
});
