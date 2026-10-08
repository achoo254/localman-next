import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
	req: Request,
	res: Response,
	next: NextFunction,
) => Promise<void>;

/**
 * Wraps an async route for hand-written (non-registry) routes such as the
 * mock runtime. Express 5 already forwards rejected promises; this wrapper
 * makes the forwarding explicit and independent of that behaviour.
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
	return (req, res, next) => {
		handler(req, res, next).catch(next);
	};
}
