// src/frontend/shared/i18n.ts
export type Locale = "en" | "zh-Hans" | "hi";

const STORAGE_KEY = "bk_locale";
export const LOCALE_CHANGED_EVENT = "bk_locale_changed";

function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh-Hans" || v === "hi";
}

function inferLocale(): Locale {
  const raw = (navigator.language ?? "").toLowerCase();
  if (raw.startsWith("zh")) return "zh-Hans";
  if (raw.startsWith("hi")) return "hi";
  return "en";
}

export function getLocale(): Locale {
  const v = localStorage.getItem(STORAGE_KEY);
  return isLocale(v) ? v : inferLocale();
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.setAttribute("lang", toHtmlLang(locale));
  window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT));
}

export function initLocale(): void {
  const locale = getLocale();
  document.documentElement.setAttribute("lang", toHtmlLang(locale));
}

export function nextLocale(current: Locale): Locale {
  if (current === "en") return "zh-Hans";
  if (current === "zh-Hans") return "hi";
  return "en";
}

function toHtmlLang(locale: Locale): string {
  if (locale === "zh-Hans") return "zh-Hans";
  return locale;
}

type Dict = Readonly<Record<string, string>>;

const DICTS: Readonly<Record<Locale, Dict>> = {
  en: {
    // Shell / nav / footer
    "nav.enquire_now": "Enquire Now",
    "menu.title": "Menu",
    "menu.theme": "Theme",
    "footer.tagline": "Premium chef-prepared meals • Brisbane, Australia",
    "footer.request_access": "Request Access",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.location": "Brisbane, Australia",
    "footer.language": "Language",

    // Home page
    "home.lede":
      "Brisbane meal prep, built around a relationship-led onboarding and a preset-driven weekly ordering loop.",
    "home.cta": "Enquire Now",

    // Request access page (form)
    "enquiry.h1": "Enquiry Form",
    "enquiry.p": "Submit an enquiry and we’ll follow up personally.",
    "enquiry.first_name": "First name (optional)",
    "enquiry.last_name": "Last name *",
    "enquiry.email": "Email *",
    "enquiry.phone": "Phone (optional)",
    "enquiry.message": "Tell us what you’re looking for *",
    "enquiry.submit": "Submit enquiry",

    // Tooltip / dialog
    "tooltip.copy": "Copy",
    "tooltip.copied": "Copied",
    "tooltip.ok": "OK",
    "tooltip.success_title": "Enquiry sent",
    "tooltip.error_title": "Couldn’t submit",
    "enquiry.submitted_ref": "Submitted successfully. Reference: {ref}",
    "enquiry.failed_status": "Submission failed ({status})",
    "enquiry.failed_generic": "Submission failed",
  },

  "zh-Hans": {
    // Shell / nav / footer
    "nav.enquire_now": "立即咨询",
    "menu.title": "菜单",
    "menu.theme": "主题",
    "footer.tagline": "高端主厨备餐 • 澳大利亚布里斯班",
    "footer.request_access": "申请访问",
    "footer.privacy": "隐私政策",
    "footer.terms": "条款",
    "footer.location": "澳大利亚 布里斯班",
    "footer.language": "语言",

    // Home page
    "home.lede": "布里斯班餐食备餐服务：以关系型沟通的入门流程与每周预设式下单为核心。",
    "home.cta": "立即咨询",

    // Request access page (form)
    "enquiry.h1": "咨询表单",
    "enquiry.p": "提交咨询，我们会尽快与您联系。",
    "enquiry.first_name": "名字（可选）",
    "enquiry.last_name": "姓氏 *",
    "enquiry.email": "邮箱 *",
    "enquiry.phone": "电话（可选）",
    "enquiry.message": "请告诉我们您的需求 *",
    "enquiry.submit": "提交咨询",

    // Tooltip / dialog
    "tooltip.copy": "复制",
    "tooltip.copied": "已复制",
    "tooltip.ok": "确定",
    "tooltip.success_title": "已发送咨询",
    "tooltip.error_title": "提交失败",
    "enquiry.submitted_ref": "提交成功。编号：{ref}",
    "enquiry.failed_status": "提交失败（{status}）",
    "enquiry.failed_generic": "提交失败",
  },

  hi: {
    // Shell / nav / footer
    "nav.enquire_now": "पूछताछ करें",
    "menu.title": "मेनू",
    "menu.theme": "थीम",
    "footer.tagline": "प्रीमियम शेफ-तैयार भोजन • ब्रिस्बेन, ऑस्ट्रेलिया",
    "footer.request_access": "अनुरोध करें",
    "footer.privacy": "गोपनीयता",
    "footer.terms": "नियम",
    "footer.location": "ब्रिस्बेन, ऑस्ट्रेलिया",
    "footer.language": "भाषा",

    // Home page
    "home.lede":
      "ब्रिस्बेन मील प्रेप — रिश्ते-आधारित ऑनबोर्डिंग और प्रीसेट-आधारित साप्ताहिक ऑर्डरिंग के साथ।",
    "home.cta": "पूछताछ करें",

    // Request access page (form)
    "enquiry.h1": "पूछताछ फ़ॉर्म",
    "enquiry.p": "अपनी पूछताछ भेजें — हम जल्द ही संपर्क करेंगे।",
    "enquiry.first_name": "पहला नाम (वैकल्पिक)",
    "enquiry.last_name": "अंतिम नाम *",
    "enquiry.email": "ईमेल *",
    "enquiry.phone": "फ़ोन (वैकल्पिक)",
    "enquiry.message": "आप क्या चाहते हैं? *",
    "enquiry.submit": "पूछताछ भेजें",

    // Tooltip / dialog
    "tooltip.copy": "कॉपी",
    "tooltip.copied": "कॉपी हो गया",
    "tooltip.ok": "ठीक है",
    "tooltip.success_title": "पूछताछ भेज दी गई",
    "tooltip.error_title": "भेजा नहीं जा सका",
    "enquiry.submitted_ref": "सफलतापूर्वक भेजा गया। संदर्भ: {ref}",
    "enquiry.failed_status": "भेजना विफल ({status})",
    "enquiry.failed_generic": "भेजना विफल",
  },
};

export function t(key: string): string {
  const locale = getLocale();
  return DICTS[locale][key] ?? DICTS.en[key] ?? key;
}

export function localeLabel(locale: Locale): string {
  if (locale === "en") return "English";
  if (locale === "zh-Hans") return "中文";
  return "हिन्दी";
}

export function localeShort(locale: Locale): string {
  if (locale === "en") return "EN";
  if (locale === "zh-Hans") return "中文";
  return "HI";
}
