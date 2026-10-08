import { Router, json } from "express";
import * as deviceLogin from "../services/device-login-service.js";

// Device-login pairing for `tunelo login`: the CLI registers its device,
// the browser approves it, the CLI polls for the issued token.
export function createDeviceRouter(): Router {
	const router = Router();
	router.use(json({ limit: "16kb" }));

	// POST /api/device/init { deviceId, name } — CLI starts a login.
	router.post("/init", async (req, res, next) => {
		try {
			const deviceId = String(req.body?.deviceId ?? "").trim();
			const name = String(req.body?.name ?? "")
				.trim()
				.slice(0, 80);
			if (!deviceId) {
				res.status(400).json({
					error: { code: "TUNELO_DEVICE_003", message: "deviceId required" },
				});
				return;
			}
			res.json(await deviceLogin.initRequest(deviceId, name));
		} catch (err) {
			next(err);
		}
	});

	// GET /api/device/request?req=... — browser reads the device to approve.
	router.get("/request", async (req, res, next) => {
		try {
			const info = await deviceLogin.getRequest(String(req.query.req ?? ""));
			if (!info) {
				res.status(404).json({
					error: { code: "TUNELO_DEVICE_002", message: "Not found or expired" },
				});
				return;
			}
			res.json(info);
		} catch (err) {
			next(err);
		}
	});

	// POST /api/device/approve { req } — browser approves the device.
	router.post("/approve", async (req, res, next) => {
		try {
			await deviceLogin.approve(String(req.body?.req ?? ""));
			res.json({ ok: true });
		} catch (err) {
			next(err);
		}
	});

	// POST /api/device/poll { req } — CLI waits for the token.
	router.post("/poll", async (req, res, next) => {
		try {
			res.json(await deviceLogin.poll(String(req.body?.req ?? "")));
		} catch (err) {
			next(err);
		}
	});

	return router;
}
