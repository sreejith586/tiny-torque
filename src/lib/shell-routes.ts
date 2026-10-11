// Routes with their own top bar / flow (landing, login, onboarding) that don't use the app shell's
// persistent header or bottom nav. Shared so AppHeader and BottomNav can't drift apart.
export const APP_SHELL_HIDDEN_ON = ['/', '/login', '/onboarding'];
