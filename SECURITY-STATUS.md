# Security status — do not deploy

This repository is undergoing security remediation and is NOT production-ready.

The original passcode login endpoint is disabled. The admin sign-in UI now starts Supabase Google OAuth, but has not been tested end to end. The announcements, messages, platforms and settings API handlers now require an admin bearer token validated against Supabase Auth and a matching verified Google identity. These checks fail closed if Supabase cannot be reached.

Still required before deployment:
- Replace the separate student-facing simulated Google login with real verified authentication. Verify the admin Google OAuth flow and configure its redirect URL once the deployment hostname is known.
- Connect a suitable database without exposing its credentials, and reconcile this app's schema with existing Supabase data; the archive's local database connection was removed.
- Audit student-facing APIs and build authorization for users' own messages, rather than allowing admin-only access to all operations.
- Test valid admin, non-admin, anonymous, expired and forged credentials, data isolation, and the complete Google sign-in redirect.

The current API authorization is an intermediate safeguard, not a finished security review. The site will not work as intended until these steps are complete. Do not deploy against real data in this state.
