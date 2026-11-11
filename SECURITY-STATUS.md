# Security status — do not deploy

This repository contains the original supplied project, saved for remediation only. It is NOT production-ready.

- Admin passcode validation is client-side and/or uses an insecure default.
- API endpoints lack proper authorization; message endpoints expose private data.
- The Google login UI is simulated and does not verify a Google identity.
- The provided database connection points to a local environment and was removed.

Do not run or deploy this project against a real database until authentication, authorization, privacy, and the database integration have been redesigned and tested. The existing websites and their data should not be replaced by this project.
