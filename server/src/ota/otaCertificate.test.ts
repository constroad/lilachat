import { describe, expect, it } from 'vitest';
import { otaCertificate } from './otaCertificate.js';

/** The deploy ships the repo's certificate with the server: if it moves or goes missing, every publish would answer 503. */
describe('otaCertificate', () => {
  it('finds the committed public certificate from the source tree', async () => {
    // Act
    const certificate = await otaCertificate();
    // Assert
    expect(certificate).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(certificate).not.toMatch(/PRIVATE KEY/);
  });
});
