/** The logging the tenancy helpers need (a pino logger fits). */
export interface TenancyLogger {
	info(obj: object, msg: string): void;
	warn(obj: object, msg: string): void;
	error(obj: object, msg: string): void;
}
