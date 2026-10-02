export function generateUsername(displayName?: string): string;

export function isValidUsername(username?: string): {
  valid: boolean;
  error?: string | null;
};

export function checkUsernameExists(
  username: string,
  currentUserId?: string | null
): Promise<boolean>;

export function generateUniqueUsername(
  displayName?: string,
  currentUserId?: string | null
): Promise<string>;
