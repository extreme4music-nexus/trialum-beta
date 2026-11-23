# v46 Internal Beta Social Access

**Status:** isolated internal-beta change; not a production authorization policy.

## Owner decision

The internal beta must let invited testers exercise Friends, messages, and shared play after they explicitly accept the social-service disclosure. A missing, unavailable, declined, or non-eligible Play Age Signals result must not lock these functions in the internal beta build.

## Build boundary

- Only the `internalBeta` Android build type sets `BETA_TESTER_TOOLS=true`.
- The ordinary `release` build keeps `BETA_TESTER_TOOLS=false` and requires an eligible native Google Play Age Signals result (shared 18+ range) plus separate social consent.
- Beta access does not report or impersonate an adult Age Signals result. The native Age Signals check remains available in the beta UI for testing; its result does not revoke internal-beta social access.
- Social consent remains required in every build. No network request or profile use starts before consent.
- Beta access is a distribution/build boundary, not proof of a tester's identity or age. Keep this artifact in the closed internal beta and use the owner's adult tester list. Do not promote this build type or its bypass behavior into a production release.
- This change does not alter the social server, server-side attestation flags, Play Games, package identity, signing, or local world data.

## Device test

1. Install the owner-signed v46 internal-beta APK with the existing release signer.
2. Open Friends and accept the social disclosure.
3. Confirm that Friends/profile access is available even if Age Signals is unavailable on a sideloaded install.
4. Use **Test Age Signals** to verify the API separately; an ineligible result must not relock this beta build.
5. Verify the ordinary non-beta release still remains blocked unless it receives an eligible 18+ signal.
6. Test profile, invitations, messages, shared play, and consent withdrawal. Do not treat the beta-only access behavior as production approval.
