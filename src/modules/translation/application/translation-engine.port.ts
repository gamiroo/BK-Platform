import type { Locale } from "../domain/locale.js";

export type TranslationPurpose = "enquiry" | "admin_note" | "chat" | "generic";

export type TranslationEnginePort = Readonly<{
  engine_name: "argos" | "mock";

  supports: (pair: Readonly<{ source_locale: Locale; target_locale: Locale }>) => boolean;

  translate: (input: Readonly<{
    text: string;
    source_locale: Locale;
    target_locale: Locale;
    purpose: TranslationPurpose;
  }>) => Promise<Readonly<{ translated_text: string; model: string }>>;
}>;
