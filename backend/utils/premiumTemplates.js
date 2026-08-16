// Gating logic for invoice/quotation PDF templates. Template 1 ("Essential")
// and template 9 ("Letterhead") are always available. Templates 2-8 are
// bundled behind the `premium_invoice_templates` App Store add-on.
export const PREMIUM_TEMPLATE_APP_ID = 'premium_invoice_templates';
export const ESSENTIAL_TEMPLATE_ID = 1;
export const LETTERHEAD_TEMPLATE_ID = 9;
export const MAX_TEMPLATE_ID = 9;
export const FREE_TEMPLATE_IDS = [ESSENTIAL_TEMPLATE_ID, LETTERHEAD_TEMPLATE_ID];

/**
 * Whether a tenant is allowed to use a specific premium template.
 * Grants access when:
 *  - the App Store add-on for that specific template is installed & enabled, OR
 *  - the tenant already had a non-essential template configured before this
 *    gating was introduced (grandfathering existing customers so nothing
 *    breaks retroactively on rollout).
 */
export function hasPremiumTemplateAccess(tenant, templateId) {
  if (!tenant) return false;

  const installedApps = tenant?.settings?.installedApps || {};
  // Check if the specific template addon is installed
  const appStatus = installedApps[`invoice_template_${templateId}`];
  if (appStatus?.isInstalled && appStatus?.isEnabled !== false) return true;

  // Grandfathering check (if they had the old bundle installed)
  const bundleStatus = installedApps[PREMIUM_TEMPLATE_APP_ID];
  if (bundleStatus?.isInstalled && bundleStatus?.isEnabled !== false) return true;

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
  if (FREE_TEMPLATE_IDS.includes(safeValue)) return safeValue;
  return hasPremiumTemplateAccess(tenant, safeValue) ? safeValue : ESSENTIAL_TEMPLATE_ID;
}
