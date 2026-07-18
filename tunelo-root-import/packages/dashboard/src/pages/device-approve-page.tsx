// Device approval page — a logged-in user confirms a CLI device code
// (`tunelo login` / `register`). Opened at /dashboard/auth/device?code=XXXX-XXXX;
// on approve the CLI's poll receives the API key.
import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client.js";

type Status = "idle" | "approving" | "approved" | "error";

export function DeviceApprovePage(): React.ReactElement {
	const [params] = useSearchParams();
	const code = (params.get("code") ?? "").toUpperCase();
	const validCode = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);

	async function handleApprove(e: FormEvent): Promise<void> {
		e.preventDefault();
		setStatus("approving");
		setError(null);
		try {
			await apiFetch("/api/auth/device/approve", {
				method: "POST",
				body: JSON.stringify({ userCode: code }),
			});
			setStatus("approved");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Approval failed");
			setStatus("error");
		}
	}

	return (
		<div className="max-w-md mx-auto mt-8">
			<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
				<div className="text-center space-y-1">
					<h1 className="text-lg font-semibold text-gray-900">
						Authorize CLI device
					</h1>
					<p className="text-sm text-gray-500">
						Confirm this matches the code shown in your terminal.
					</p>
				</div>

				{!validCode && (
					<div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
						Missing or invalid device code. Re-run <code>tunelo login</code> in
						your terminal.
					</div>
				)}

				{validCode && (
					<div className="text-center font-mono text-2xl tracking-widest text-gray-900 bg-gray-50 border border-gray-200 rounded py-3">
						{code}
					</div>
				)}

				{error && (
					<div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
						{error}
					</div>
				)}

				{status === "approved" ? (
					<div className="bg-green-50 border border-green-200 rounded px-3 py-3 text-sm text-green-700 text-center">
						Device authorized. Return to your terminal — the CLI is now signed
						in.
					</div>
				) : (
					<form onSubmit={(e) => void handleApprove(e)}>
						<button
							type="submit"
							disabled={!validCode || status === "approving"}
							className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{status === "approving" ? "Authorizing…" : "Authorize device"}
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
