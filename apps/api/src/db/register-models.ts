// Registers every model, as the server does: the operations registry
// imports every module's models, the auth module its own (sessions,
// sign-in transactions, logout tokens, audit events).
import "../operations/registry.js";
import "../modules/auth/auth-module.js";
