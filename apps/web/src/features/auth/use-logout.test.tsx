import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lockVault } from "../secure-vault/vault-session";
import { useLogout } from "./use-logout";

vi.mock("../notifications/release-push-on-logout", () => ({
	releasePushSubscriptionForLogout: vi.fn(async () => undefined),
}));
vi.mock("../secure-vault/vault-session", () => ({
	lockVault: vi.fn(async () => undefined),
}));

describe("useLogout", () => {
	it("locks the secret vault on this device before leaving", async () => {
		const { result } = renderHook(() => useLogout("logout-form"));
		await act(() => result.current.logout());
		expect(lockVault).toHaveBeenCalledTimes(1);
	});

	it("still leaves when locking fails", async () => {
		vi.mocked(lockVault).mockRejectedValueOnce(new Error("storage"));
		const { result } = renderHook(() => useLogout("logout-form"));
		await expect(act(() => result.current.logout())).resolves.toBeUndefined();
	});
});
