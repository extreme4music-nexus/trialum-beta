#!/usr/bin/env python3
"""Basic public repository checks; NOT an exhaustive secret or license audit."""
from pathlib import Path
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
blocked_parts = {".git", ".env", ".ssh", "node_modules", ".gradle", "backups", "secrets", "__pycache__"}
blocked_exts = {".jks", ".keystore", ".p12", ".pfx", ".pem", ".key", ".sqlite", ".db"}
blocked_names = {"google-services.json", "service-account.json", "id_rsa", "id_ed25519", "credentials.json"}
source_dirs = {"android", "app", "server", "src", "web", "game", "model-packs", "www", "assets"}
patterns = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "GitHub token": re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{25,}\b"),
    "fine-grained GitHub token": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"),
    "AWS key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
}
issues = []
source_found = False
for p in root.rglob("*"):
    if not p.is_file():
        continue
    relative = p.relative_to(root)
    if any(x in blocked_parts or x.startswith(".env") for x in relative.parts):
        issues.append(f"Blocked path: {relative}")
        continue
    if p.suffix.lower() in blocked_exts or p.name.lower() in blocked_names:
        issues.append(f"Blocked file: {relative}")
        continue
    if relative.parts[0] in source_dirs:
        source_found = True
    if p.stat().st_size > 5000000:
        issues.append(f"Manual review of large file required: {relative}")
        continue
    try:
        content = p.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    for label, regex in patterns.items():
        for match in regex.finditer(content):
            line = content.count("\n", 0, match.start()) + 1
            issues.append(f"{label} pattern: {relative}:{line}")
for required in ("README.md", "LICENSE", "RELEASE_POLICY.md", "SECURITY.md"):
    if not (root / required).is_file():
        issues.append(f"Missing required file: {required}")
if source_found:
    manifest = root / ".trialum-release.json"
    if not manifest.is_file():
        issues.append("Game source present without an approved release manifest")
    else:
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            if not re.fullmatch(r"[0-9a-f]{40}", str(data.get("source_commit", ""))):
                issues.append("Invalid source_commit in release manifest")
            if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?-beta\.[0-9A-Za-z.-]+", str(data.get("version", ""))):
                issues.append("Invalid beta version in release manifest")
            for k in ("owner_approved", "license_review_complete", "secret_scan_complete", "qa_acceptance_complete"):
                if data.get(k) is not True:
                    issues.append(f"Manifest missing true {k}")
        except (ValueError, OSError):
            issues.append("Malformed release manifest")
print("Basic repository gate:", "FAILED" if issues else "PASS")
for issue in issues:
    print(issue)
if not issues:
    print("Advisory automated checks passed; owner/legal/security review still required.")
sys.exit(1 if issues else 0)
