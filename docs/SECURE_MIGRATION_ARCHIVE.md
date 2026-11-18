# Trialum encrypted migration archive

## Purpose

The archive moves the player's world and private memories between devices without sending plaintext to the Trialum server. Creating or restoring it is an explicit user action. It is separate from plain JSON export and Google Play Games Cloud Save.

## Contents

- Complete validated game-world state, including local pet AI memories and pet dialogue history.
- This installation's locally stored friend-message threads and local delivery/read metadata.
- No social credential, Google OAuth token, model file, or server secret.

Plain JSON and Play Games Cloud Save continue to omit private AI memory and conversation history. Existing encrypted archives belong to the user and must be stored separately from their recovery code.

## Format version 1

- JSON envelope: `trialum-encrypted-archive`, version `1`.
- Key derivation: PBKDF2-HMAC-SHA-256, 600,000 iterations; 16-byte random salt.
- Encryption and authentication: AES-256-GCM, 12-byte random nonce, 128-bit tag.
- The recovery code is generated from 256 random bits, displayed during archive creation, and never stored by Trialum. It is normalized to 64 hexadecimal characters before key derivation.
- The serialized archive and ciphertext are limited to 20 MiB. Android verifies the ciphertext's format and SHA-256 after writing to the user-selected document provider.

## User flow and limits

1. In Settings, choose **Encrypted migration archive**.
2. Save the one-time recovery code somewhere separate from the archive, then confirm it is saved.
3. Save the encrypted JSON file. Android's system document picker can target Google Drive when its document provider is available; Trialum receives no Drive OAuth token or broad Drive scope.
4. On the new device, choose **Restore encrypted archive**, select the file, enter the recovery code, and confirm replacement.

Loss of the recovery code makes the archive unrecoverable. Google Drive stores the ciphertext, while the app can decrypt it after the player enters the code. This is client-side encryption; it is not a claim that the publisher has no legal or product responsibility. Google Play Games and plain JSON do not provide this archive's end-to-end encryption.

## Implementation boundaries

- The archive is never uploaded through Trialum APIs or server WebSockets.
- Android keeps up to three encrypted staging copies in its private no-backup area to survive the document picker; these are ciphertext only. The regular rolling rescue store continues to hold the app's existing local world snapshots.
- Restore validates the game world and conversation schema before replacing local data and asks for confirmation. A previous local world and conversation list are retained in memory for rollback if conversation restoration fails.
- Direct Google Drive REST/OAuth synchronization is not implemented. The OS document provider is used so the player selects the destination and Trialum does not request Drive API authorization.
