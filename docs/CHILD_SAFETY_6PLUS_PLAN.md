# Trialum 6+ child-safety implementation ledger

Status: active design and implementation work on `feature/child-safety-6plus`.
Base snapshot: `318f2b5b80a20a3f1e9dce1d570b00464664c9b7`.

## Product invariant

The local game remains playable without an account or network access. Existing
worlds, pets, progression, local AI, backups, and history are not to be removed
or rewritten by age-safety work. Network features must fail closed when age or
permission is unknown.

## Age source, consent, and cost guard

- For this internal-only update, use Google Play Age Signals. The beta build
  accepts a shared 18+ range from TIER_A, TIER_C, or TIER_D only because the
  internal track is restricted to the publisher's manually curated 18+ tester
  list. TIER_A is self-declared and is not treated as verified evidence for a
  public release. TIER_B, a child range, not-shared, unknown, null, failed, and
  stale results remain offline-only. This is not a global parent-consent service.
- Keep social features disabled by default. Do not enable them for managed child
  accounts. In regions where Play does not provide a sufficient signal, keep
  the game offline-only. Do not infer a lawful launch-country list from API
  coverage; the publisher must approve an explicit Play country allowlist.
- Add the Kai integration boundary as an inactive provider adapter only. Do not
  install or call Kai, create production credentials, or activate billing in
  this update. The owner has prohibited paid plans and unapproved spending.
- k-ID's published Kai offer is $0 for the first 10,000 monthly users and
  $0.02 per user above that threshold, billed monthly; therefore it is not
  risk-free to activate without a verified hard cap and explicit owner approval.
- Keep a child/teen, unverified, expired, unavailable, or unknown state in
  offline-only mode. Server-authoritative permission is required before any
  internet social capability can be enabled.
- Do not request or retain exact date of birth, parent email, identity evidence,
  or raw provider session payload on Trialum. Store only a pseudonymous provider
  session reference and the minimal, per-feature permission state required for
  server enforcement, protected at rest and removable on profile deletion.
- If the provider SDK cannot run in the current Android WebView, or cannot
  enforce the no-overage limit, keep child social functions locked until a
  compatible free path is confirmed.

## Feature boundary

Features to classify and gate consistently include Internet Friends and invites,
Nearby friend discovery, P2P friend exchange, messages, shared rooms and live
pet speech, background shared AI, FCM registration/push, and Play Games cloud,
leaderboards, and achievements. Offline gameplay, local AI, local saves, and
local JSON backup remain available.

## Parent approval and server boundary

- A local checkbox or a PIN created on the child's device is not labelled as
  verified parental consent.
- Google Play significant-change approval is usable only where Google Play
  applies that mechanism and the app has submitted the relevant significant
  change. It is not a global substitute for COPPA verifiable parental consent.
- The initial internal test may use Play Age Signals to keep profiles without
  a shared 18+ range offline. Do not claim that Age Signals proves a parent approved all
  social features; managed child profiles remain locked in this phase.
- Internal-test country exclusions do not constrain internal testers: Google
  says they may still install from any location. Therefore region restrictions
  must be enforced by app/server feature gates as well as by the later
  production country allowlist.
- Trialum social APIs currently authenticate an installation credential and
  do not verify age or guardian permission. A UI-only gate is not a server-side
  authorization boundary.
- Do not deploy a server migration or enable child social access until the
  server can verify provider permissions and revocations, and enforce the
  monthly free-use cap. The k-ID API key and webhook secret belong only in the
  private server environment, never in this public build repository.

## Release gate

Before claiming 6+ readiness, review each SDK/API and its child-directed terms,
the live server configuration and retention, all Play Console declarations,
and the parent notice/consent and deletion process. Owner testing and the
publisher's legal certification remain separate from code implementation.
