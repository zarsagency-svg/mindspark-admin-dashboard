# Dashboard status

The original demo's fake Google login, default passcode, local PostgreSQL APIs and seed code have been removed from the live routes. The dashboard uses Supabase Google OAuth and database functions with admin-only checks. The existing notification and visitor-message tables remain in place. No fake analytics are displayed.

The migration is already applied to the connected Supabase project. Unauthenticated access to the two dashboard functions was tested and denied. Full Google OAuth login, non-admin authorization and successful admin operations require a real Google sign-in and remain to be tested. Add the eventual deployment URL to the Supabase redirect allowlist before testing. Do not claim the application is production-verified before completing those tests.

This initial version includes read-only visitor messages and posting text announcements. Private replies, analytics, image uploads, message deletion and visitor Google login are not yet implemented.
