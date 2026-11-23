# v47 pet-name localization audit

## Rule

Translate generated **species-based display names** only. Never translate or rewrite a player's custom pet name or the saved `pet.name` value.

The default generator names a pet from its fictional species plus a sequence number. v47 records `nameIsCustom: false` for newly generated names. `TrialumEngine.rename()` marks a player rename as custom. For older saves without the marker, the display helper only localizes an exact current species-name plus numeric suffix; other names remain untouched.

## Species inventory

| Stored species name | English display name | Source |
|---|---|---|
| Лумира | Lumira | `js/engine.js` |
| Кристел | Crystel | `js/engine.js` |
| Нубела | Nubela | `js/engine.js` |
| Флорикс | Florix | `js/engine.js` |
| Синапсо | Synapso | `js/progression.js` |
| Тералин | Teralin | `js/progression.js` |
| Орбивокс | Orbivox | `js/progression.js` |
| Ноетриум | Noetrium | `js/progression.js` |

The English locale already contains all eight Macedonian-to-English vocabulary mappings. v47 adds a display-only helper and applies it to pet UI surfaces which were deliberately excluded from generic DOM translation to protect player-authored names.

## Surfaces covered

- Pet list and selected-pet summary.
- Pet name in the local playground HUD and canvas.
- On-device pet chat heading, speaker labels, and accessibility labels.
- Shared-playground visitor/occupant cards when the payload includes a species index.

## Data preservation

- No save migration rewrites names.
- Exports, cognitive memories, journal entries, and server payloads retain the stored name.
- If a player renames a pet, the chosen text is displayed exactly as entered.
- Future species must be added to the English vocabulary map and reviewed against every pet display surface.
