/** Tauri returns errors as `{ kind, message }` objects (see Rust CmdError).
 *  Plain `String(e)` on those yields "[object Object]" — this helper unpacks
 *  the most useful message regardless of shape. */
export function errMsg(e: unknown): string {
  if (e == null) return "unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const any = e as Record<string, unknown>;
    if (typeof any.message === "string") return any.message;
    try { return JSON.stringify(e); } catch { return String(e); }
  }
  return String(e);
}
