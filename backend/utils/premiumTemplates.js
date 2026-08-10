// Gating logic for invoice/quotation PDF templates. Template 1 ("Essential")
// is always available to every tenant. Templates 2-8 are bundled behind the
// `premium_invoice_templates` App Store add-on so they can be marketed,
// installed and toggled like any other Maqder module.
export const PREMIUM_TEMPLATE_APP_ID = 'premium_invoice_templates';
export const ESSENTIAL_TEMPLATE_ID = 1;
export const MAX_TEMPLATE_ID = 8;

/**
 * Whether a tenant is allowed to use templates 2-8.
 * Grants access when:
 *  - the App Store add-on is explicitly installed & enabled, OR
 *  - the tenant already had a non-essential template configured before this
 *    gating was introduced (grandfathering existing customers so nothing
 *    breaks retroactively on rollout).
 */
export function hasPremiumTemplateAccess(tenant) {
  if (!tenant) return false;

  const installedApps = tenant?.settings?.installedApps || {};
  const appStatus = installedApps[PREMIUM_TEMPLATE_APP_ID];
  if (appStatus?.isInstalled && appStatus?.isEnabled !== false) return true;

  const currentDefault = Number(tenant?.settings?.invoicePdfTemplate);
  if (Number.isFinite(currentDefault) && currentDefault > ESSENTIAL_TEMPLATE_ID) return true;

  const contextProfiles = tenant?.settings?.invoiceBranding?.contextProfiles || {};
  return Object.values(contextProfiles).some((profile) => Number(profile?.templateId) > ESSENTIAL_TEMPLATE_ID);
}

/**
 * Clamp a requested template id to what the tenant is actually entitled to
 * use. Falls back to the Essential template (1) when the tenant hasn't
 * unlocked the premium template pack.
 */
export function clampTemplateId(tenant, requestedTemplateId) {
  const value = Number(requestedTemplateId);
  const safeValue = Number.isFinite(value) ? Math.min(MAX_TEMPLATE_ID, Math.max(1, value)) : ESSENTIAL_TEMPLATE_ID;
  if (safeValue === ESSENTIAL_TEMPLATE_ID) return safeValue;
  return hasPremiumTemplateAccess(tenant) ? safeValue : ESSENTIAL_TEMPLATE_ID;
}
