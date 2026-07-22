/** The verified identity extracted from a Google ID token. */
export interface GoogleIdentity {
  googleId: string;
  /** Lowercased, matching `User.email`'s own case-insensitive convention. */
  email: string;
}
