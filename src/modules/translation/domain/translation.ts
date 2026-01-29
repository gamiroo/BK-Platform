import type { Locale } from "./locale.js";

export type TranslationEngineName = "argos" | "mock";

export type TranslationProvenance = Readonly<{
  engine: TranslationEngineName;
  model: string;
  created_at: string; // ISO string
}>;

export type Translation = Readonly<{
  original_text: string;
  translated_text: string;
  source_locale: Locale;
  target_locale: Locale;
  provenance: TranslationProvenance;
}>;
