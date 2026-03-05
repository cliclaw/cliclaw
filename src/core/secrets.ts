/**
 * Secret scanning — redact potential secrets from prompts before sending to agents.
 */

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "AWS Secret Key", pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: "Generic API Key", pattern: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/gi },
  { name: "Bearer Token", pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/g },
  { name: "Private Key Block", pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g },
  { name: "npm Token", pattern: /npm_[A-Za-z0-9]{36}/g },
  { name: "Slack Token", pattern: /xox[baprs]-[A-Za-z0-9-]+/g },
  { name: "Generic Secret", pattern: /(?:password|passwd|pwd|secret)\s*[:=]\s*["'][^"'\s]{8,}["']/gi },
];

export interface ScanResult {
  clean: string;
  redacted: number;
  findings: string[];
}

export function scanAndRedact(text: string): ScanResult {
  let clean = text;
  let redacted = 0;
  const findings: string[] = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = clean.match(pattern);
    if (matches) {
      for (const match of matches) {
        clean = clean.replace(match, `[REDACTED:${name}]`);
        redacted++;
        findings.push(`${name}: ${match.slice(0, 8)}...`);
      }
    }
  }

  return { clean, redacted, findings };
}

export function hasSecrets(text: string): boolean {
  for (const { pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}
