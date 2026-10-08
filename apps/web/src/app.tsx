import { RouterProvider } from "react-router/dom";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";

export function App() {
	return (
		<TooltipProvider>
			<ToastProvider>
				<RouterProvider router={router} />
			</ToastProvider>
		</TooltipProvider>
	);
}
