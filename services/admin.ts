function parseAdminEmails(rawValue: string | undefined): string[] {
  if (!rawValue) return [];

  return rawValue
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedAdminEmails(): string[] {
  return parseAdminEmails(process.env.EXPO_PUBLIC_ADMIN_EMAILS);
}

export function isAllowedAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}