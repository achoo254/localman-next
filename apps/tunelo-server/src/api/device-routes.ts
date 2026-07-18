import { Router, json } from "express";
import * as deviceLogin from "../services/device-login-service.js";

// Browser<->CLI pairing endpoints for `tunelo login`.
export function createDeviceRouter(): Router {
	const router = Router();
	router.use(json({ limit: "16kb" }));

	// GET /api/device/status?code=XXXX-XXXX — browser polls; status only.
	router.get("/status", async (req, res, next) => {
		try {
			const code = String(req.query.code ?? "");
			if (!code) {
				res.status(400).json({ status: "expired" });
				return;
			}
			res.json({ status: await deviceLogin.getStatus(code) });
		} catch (err) {
			next(err);
		}
	});

	// POST /api/device/claim { code } — CLI submits the pasted code, gets a token.
	router.post("/claim", async (req, res, next) => {
		try {
			const code = String(req.body?.code ?? "")
				.trim()
				.toUpperCase();
			const { token } = await deviceLogin.claim(code);
			res.json({ token });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
