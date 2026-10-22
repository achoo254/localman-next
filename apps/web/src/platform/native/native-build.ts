/**
 * True only in the bundle packaged into the iOS/Android shell
 * (`vite build --mode native`, apps/mobile). A build-time constant, so the
 * web bundle drops every native branch and never loads Capacitor.
 */
export const isNativeBuild: boolean = import.meta.env.VITE_NATIVE === "true";

/** Path of the verified https link the IdP hop ends on (Universal / App Link). */
export const MOBILE_CALLBACK_PATH = "/m/auth/callback";
