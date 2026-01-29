import type { Locale } from "../domain/locale.js";
import type { Translation } from "../domain/translation.js";
import type { TranslationEnginePort, TranslationPurpose } from "./translation-engine.port.js";

// NOTE: adjust this import to your actual AppError location.
import { AppError } from "../../../shared/errors/app-error.js";

export type TranslateTextCommand = Readonly<{
  text: string;
  target_locale: Locale;
  source_locale?: Locale;
  purpose: TranslationPurpose;
}>;

export type TranslationResult = Readonly<{ translation: Translation }>;

const MAX_TEXT_CHARS = 8_000;

export function createTranslateText(deps: Readonly<{ engine: TranslationEnginePort }>) {
  return async function translateText(cmd: TranslateTextCommand): Promise<TranslationResult> {
    const text = cmd.text.trim();
    if (!text) {
      throw new AppError({
        code: "TRANSLATION_INVALID_INPUT",
        status: 400,
        message: "Text is required",
      });
    }

    if (text.length > MAX_TEXT_CHARS) {
      throw new AppError({
        code: "TRANSLATION_TEXT_TOO_LONG",
        status: 413,
        message: `Text exceeds max length (${MAX_TEXT_CHARS} chars)`,
        details: { max_chars: MAX_TEXT_CHARS },
      });
    }

    const source_locale = cmd.source_locale ?? "en"; // deterministic default (no auto-detect in contract)
    const target_locale = cmd.target_locale;

    if (!deps.engine.supports({ source_locale, target_locale })) {
      throw new AppError({
        code: "TRANSLATION_UNSUPPORTED_LANGUAGE_PAIR",
        status: 422,
        message: "Unsupported language pair",
        details: { source_locale, target_locale },
      });
    }

    const out = await deps.engine.translate({
      text,
      source_locale,
      target_locale,
      purpose: cmd.purpose,
    });

    const translation: Translation = {
      original_text: text,
      translated_text: out.translated_text,
      source_locale,
      target_locale,
      provenance: {
        engine: deps.engine.engine_name,
        model: out.model,
        created_at: new Date().toISOString(),
      },
    };

    return { translation };
  };
}
