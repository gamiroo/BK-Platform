# Translation Module — Domain Contract (DDD‑Clean)

## Purpose
The **Translation module** provides deterministic, auditable translation of *content* (not UI chrome) inside Balance. It is explicitly **not** responsible for UI string localisation. Its role is to translate **user‑generated or staff‑generated free‑text** while preserving provenance, originals, and failure semantics.

This module is designed to support offline engines (e.g. Argos Translate) and future pluggable providers, without leaking infrastructure concerns into domain or application layers.

---

## Explicit Non‑Goals

- ❌ Translating UI labels, buttons, navigation text
- ❌ Runtime translation in the browser
- ❌ Silent mutation of source text
- ❌ Lossy translation without provenance

UI localisation remains dictionary‑based and deterministic.

---

## Bounded Context

**Context name:** `translation`

**Upstream contexts:**
- enquiry
- chat
- admin
- email

**Downstream contexts:**
- audit / logging
- notifications

The translation context never owns the original content — it only *derives* translations from it.

---

## Ubiquitous Language

| Term | Meaning |
|-----|--------|
| Source Text | Original, user‑supplied or staff‑supplied content |
| Target Language | Language the text is translated into |
| Translation | A derived representation of source text |
| Provider | Translation engine implementation (Argos, etc.) |
| Provenance | Metadata describing how/when translation was produced |
| Deterministic | Same input + model ⇒ same output |

---

## Domain Types

### LanguageCode
```ts
type LanguageCode = string; // ISO‑639‑1 or BCP‑47 (e.g. 'en', 'zh', 'hi', 'zh‑CN')
```

### TranslationProvenance
```ts
interface TranslationProvenance {
  provider: 'argos';
  model: string;          // e.g. 'argos‑zh‑en‑v1'
  generated_at: string;   // ISO timestamp
  confidence?: number;    // optional engine‑specific metric
}
```

### TranslationResult
```ts
interface TranslationResult {
  source_text: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
  translated_text: string;
  provenance: TranslationProvenance;
}
```

---

## Domain Errors

All errors are **explicit and typed**. No silent fallbacks.

```ts
class TranslationError extends Error {
  readonly code:
    | 'UNSUPPORTED_LANGUAGE'
    | 'MODEL_NOT_AVAILABLE'
    | 'ENGINE_FAILURE'
    | 'TIMEOUT'
    | 'INVALID_INPUT';
}
```

---

## Domain Interface (Port)

This is the *only* contract the application layer depends on.

```ts
interface TranslationService {
  translate(input: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  }): Promise<TranslationResult>;
}
```

Rules:
- Must never mutate `text`
- Must throw `TranslationError` on failure
- Must include provenance

---

## Application Layer

### Use Case: Translate Text

```ts
translateText(input): TranslationResult
```

Responsibilities:
- Validate input (non‑empty, sane length)
- Select provider (currently Argos)
- Normalize errors
- Emit structured logs

It **does not**:
- Decide when translation happens
- Persist data
- Detect language (explicit only)

---

## Infrastructure Layer

### Argos Adapter

Location:
```
src/modules/translation/infrastructure/argos/
```

Responsibilities:
- Load language models
- Execute translation
- Map Argos failures → TranslationError

No domain objects leak out of this layer.

---

## Persistence Strategy (Optional)

Translations may be stored by *calling contexts*, not by this module.

Recommended schema pattern:

```ts
{
  original_text,
  original_language,
  translated_text,
  target_language,
  translation_provider,
  translation_model,
  translated_at
}
```

This enables:
- Auditability
- Re‑translation if models improve
- Legal traceability

---

## Security & Compliance

- No external network calls required (offline engines)
- No PII mutation — original always preserved
- Translation failures must be observable

---

## Testing Contract

Required tests:
- Happy path translation
- Unsupported language
- Missing model
- Engine crash
- Deterministic output for same input

No integration tests with live UIs.

---

## Example Usage

```ts
const result = await translationService.translate({
  text: enquiry.message,
  sourceLanguage: 'zh',
  targetLanguage: 'en',
});

// store alongside original
```

---

## Summary

- UI stays dictionary‑based
- Content translation is explicit, auditable, deterministic
- Argos is an implementation detail, not a dependency
- Domain stays clean and future‑proof

This contract is stable and safe to build against.

