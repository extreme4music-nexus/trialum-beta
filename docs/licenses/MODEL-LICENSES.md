# Optional on-device model licenses — Trialum v41 / 1.2

The models below are **not bundled in the APK**. They are offered as optional, user-initiated downloads. Each entry is pinned in `ModelRuntime.kt` by immutable Hugging Face revision, exact file size and SHA-256.

| Model file | Source and immutable revision | License indicated by publisher | Integrity |
|---|---|---|---|
| `SmolLM2-135M-Instruct-Q3_K_M.gguf` | [unsloth/SmolLM2-135M-Instruct-GGUF](https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/tree/8637628433dc3df4a2d363adc89e4c3917f299dc) | Apache License 2.0 (repository model card metadata) | 93,510,208 bytes; SHA-256 `3e8e1ce198396779d5a8e60e20c469ad5e064624f4e99790af40de57b46fec95` |
| `qwen2.5-0.5b-instruct-q4_k_m.gguf` | [Qwen/Qwen2.5-0.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67) | Apache License 2.0 | 491,400,032 bytes; SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db` |
| `qwen2.5-1.5b-instruct-q4_k_m.gguf` | [Qwen/Qwen2.5-1.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/91cad51170dc346986eccefdc2dd33a9da36ead9) | Apache License 2.0 | 1,117,320,736 bytes; SHA-256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e` |

**Verification note:** the Qwen repositories’ LICENSE is Apache-2.0 and the SmolLM2-GGUF repository identifies Apache-2.0 in its model metadata. At the exact pinned revision, the GGUF model card declares Apache-2.0. Before enabling downloads, retain a complete Apache-2.0 license copy in the shipped notice package and verify the quantized derivative's redistribution rights against upstream terms. The same Apache-2.0 license applies to the two pinned Qwen repositories, whose LICENSE is present at the selected revision. Model license permissions do not grant rights to underlying training data or guarantee non-infringing outputs. No model license guarantees legal safety in every jurisdiction.
