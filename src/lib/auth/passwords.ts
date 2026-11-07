/**
 * Adwa Cyber — common-password deny list (OWASP A04).
 * These meet the naive length+letters+numbers policy but are among the most
 * breached passwords in the wild; new passwords and admin resets reject them.
 * (Case-insensitive; checked on top of the length/complexity policy.)
 */
const COMMON_PASSWORDS = new Set([
  "password1", "password12", "password123", "password1234",
  "passw0rd123", "p@ssword123", "password2024", "password2025", "password2026",
  "1234567890", "123456789a", "qwerty12345", "qwerty123456", "qazwsx12345",
  "letmein1234", "welcome1234", "welcome2026", "admin123456", "administrator1",
  "iloveyou123", "sunshine123", "princess123", "football123", "baseball123",
  "superman123", "batman12345", "trustno1234", "monkey12345", "dragon12345",
  "master12345", "shadow12345", "michael1234", "jennifer123", "abcd123456",
]);

/** True when the password is a known common/breached password. */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
