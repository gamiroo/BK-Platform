export type Locale = "en" | "zh-Hans" | "hi";

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh-Hans" || v === "hi";
}
