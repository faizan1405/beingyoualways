/**
 * What the sign-in page says when the server sends a shopper back from Google with
 * `?google=failed&reason=…`. Every sentence states plainly that nobody was signed in.
 */
const MESSAGES: Record<string, string> = {
  cancelled: "You cancelled the Google sign-in. Nothing was signed in.",
  expired: "That Google sign-in took too long or was opened in another tab. Nothing was signed in — please try again.",
  password_account: "An account with this email was opened with a password. Sign in with your email and password first — Google can't open it until the email is confirmed.",
  linked_elsewhere: "This email is already connected to a different Google account. Use that Google account, or sign in with your email and password.",
  removed: "This account has been removed. You can create a new one.",
  blocked: "This account can't sign in right now. Please contact the store.",
  unavailable: "Google couldn't be reached. Nothing was signed in — please try again in a moment.",
  not_configured: "Google sign-in isn't set up on this store yet. Nothing was signed in.",
};

export const GOOGLE_FAILED_DEFAULT = "Google sign-in didn't finish. Nothing was signed in — please try again or use your email and password.";

export function googleFailureMessage(reason: string | undefined): string {
  return (reason && Object.prototype.hasOwnProperty.call(MESSAGES, reason) ? MESSAGES[reason] : undefined) ?? GOOGLE_FAILED_DEFAULT;
}
