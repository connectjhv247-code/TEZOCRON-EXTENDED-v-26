/**
 * Sanitizes backend authentication errors into user-friendly TEZOCRON EXTENDED messages.
 * Ensures zero exposure of backend provider names or internal stack details,
 * while clearly surfacing provider configuration issues if Google Auth is disabled in Firebase console.
 */
export function translateAuthError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const errObj = error as { message?: string; status?: number; code?: string };
  const code = (errObj.code || '').toLowerCase();
  const message = (errObj.message || '').toLowerCase();

  // Handle disabled or unconfigured OAuth Provider in Firebase / Auth project
  if (
    code.includes('operation-not-allowed') ||
    code.includes('unsupported-provider') ||
    message.includes('provider is not enabled') ||
    message.includes('unsupported provider') ||
    message.includes('provider_not_enabled') ||
    message.includes('operation-not-allowed')
  ) {
    return "We couldn't complete your sign-in. Please try again.";
  }

  if (
    code.includes('popup-closed-by-user') ||
    code.includes('cancelled-popup-request') ||
    message.includes('popup-closed-by-user')
  ) {
    return 'Authentication window was closed before completion. Please try again.';
  }

  if (
    code.includes('invalid-credential') ||
    code.includes('user-not-found') ||
    code.includes('wrong-password') ||
    code.includes('invalid-email') ||
    message.includes('invalid login credentials') ||
    message.includes('invalid_credentials')
  ) {
    return 'Unable to sign in. Please check your email and password and try again.';
  }

  if (
    code.includes('email-already-in-use') ||
    message.includes('user already registered') ||
    message.includes('already_exists')
  ) {
    return 'An account with this email address already exists. Please select Login.';
  }

  if (
    code.includes('weak-password') ||
    message.includes('password should be at least') ||
    message.includes('weak password')
  ) {
    return 'Your password must be at least 6 characters long.';
  }

  if (
    code.includes('too-many-requests') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'Too many connection attempts. Please wait a moment and try again.';
  }

  if (
    code.includes('network-request-failed') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  ) {
    return 'Network connection issue. Please check your internet connection.';
  }

  // Fallback sanitized user message
  return "We couldn't complete your sign-in. Please try again.";
}
