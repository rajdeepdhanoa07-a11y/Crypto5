/** Key used to sign the login cookie. Uses AUTH_SECRET if set; otherwise it is derived from
 *  APP_PASSWORD and the database URL, so one less setting is needed. Works in Node and Edge. */
export async function signingKey(): Promise<Uint8Array> {
  const s = process.env.AUTH_SECRET || `crypto5|${process.env.APP_PASSWORD ?? ''}|${process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''}`;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
