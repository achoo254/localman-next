import type { NotificationService } from "./notification-service.js";

let current: NotificationService | undefined;

/**
 * The process-wide notification service. Operations are declared statically
 * in the registry, so they reach the configured channels through here;
 * `main.ts` (and tests) install the instance at startup.
 */
export function setNotificationService(service: NotificationService): void {
	current = service;
}

export function getNotificationService(): NotificationService {
	if (!current) throw new Error("Notification service is not configured");
	return current;
}
