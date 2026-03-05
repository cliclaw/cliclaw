import { describe, it, expect } from "vitest";
import { scanAndRedact, hasSecrets } from "../src/core/secrets.js";

describe("scanAndRedact", () => {
  it("redacts AWS access keys", () => {
    const result = scanAndRedact("key=AKIAIOSFODNN7EXAMPLE");
    expect(result.clean).toContain("[REDACTED:AWS Access Key]");
    expect(result.redacted).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("redacts GitHub tokens", () => {
    const result = scanAndRedact("token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl");
    expect(result.clean).toContain("[REDACTED:GitHub Token]");
    expect(result.redacted).toBeGreaterThan(0);
  });

  it("redacts Bearer tokens", () => {
    const result = scanAndRedact("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
    expect(result.clean).toContain("[REDACTED:Bearer Token]");
  });

  it("redacts private key blocks", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg\n-----END PRIVATE KEY-----";
    const result = scanAndRedact(pem);
    expect(result.clean).toContain("[REDACTED:Private Key Block]");
  });

  it("redacts npm tokens", () => {
    const result = scanAndRedact("npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij");
    expect(result.clean).toContain("[REDACTED:npm Token]");
  });

  it("redacts Slack tokens", () => {
    const result = scanAndRedact("xoxb-123456789-abcdefghij");
    expect(result.clean).toContain("[REDACTED:Slack Token]");
  });

  it("redacts generic API keys", () => {
    const result = scanAndRedact('api_key="sk_live_abcdefghijklmnopqrst"');
    expect(result.clean).toContain("[REDACTED:");
    expect(result.redacted).toBeGreaterThan(0);
  });

  it("redacts generic secrets/passwords", () => {
    const result = scanAndRedact('password="mysupersecretpassword123"');
    expect(result.clean).toContain("[REDACTED:Generic Secret]");
  });

  it("returns clean text when no secrets", () => {
    const result = scanAndRedact("Hello world, no secrets here");
    expect(result.clean).toBe("Hello world, no secrets here");
    expect(result.redacted).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("handles multiple secrets in one text", () => {
    const text = 'AKIAIOSFODNN7EXAMPLE and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl';
    const result = scanAndRedact(text);
    expect(result.redacted).toBeGreaterThanOrEqual(2);
  });
});

describe("hasSecrets", () => {
  it("returns true when secrets present", () => {
    expect(hasSecrets("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(hasSecrets("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl")).toBe(true);
  });

  it("returns false when no secrets", () => {
    expect(hasSecrets("just normal text")).toBe(false);
  });
});
