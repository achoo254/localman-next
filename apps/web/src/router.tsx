import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/layout/app-layout";
import { PrimitivesPage } from "./pages/primitives/primitives-page";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <AppLayout />,
		children: [{ index: true, element: <PrimitivesPage /> }],
	},
]);
