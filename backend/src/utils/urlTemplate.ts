export interface TemplateVars {
  click_id: string;
  sub1: string;
  sub2: string;
  sub3: string;
  offer_id: string;
}

/**
 * Подставляет в шаблон URL плейсхолдеры {click_id}, {sub1}, {sub2}, {sub3}, {offer_id}.
 * Значения URL-кодируются. Возвращает null, если шаблон пустой/невалидный.
 */
export function applyUrlTemplate(template: string, vars: TemplateVars): string | null {
  if (!template) return null;
  const enc = (v: string | undefined | null) => encodeURIComponent(v ?? '');

  let url = template.trim();
  url = url.replace(/\{click_id\}/g, enc(vars.click_id));
  url = url.replace(/\{sub1\}/g, enc(vars.sub1));
  url = url.replace(/\{sub2\}/g, enc(vars.sub2));
  url = url.replace(/\{sub3\}/g, enc(vars.sub3));
  url = url.replace(/\{offer_id\}/g, enc(vars.offer_id));

  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

/** Оставляет в шаблоне только плейсхолдеры, разрешённые в ТЗ. */
export function validateTemplate(template: string): boolean {
  const allowed = /\{(click_id|sub1|sub2|sub3|offer_id)\}/g;
  const cleaned = String(template).replace(allowed, '');
  return !cleaned.includes('{') && !cleaned.includes('}');
}