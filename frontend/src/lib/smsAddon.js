/**
 * Whether the tenant may use SMS Marketing APIs.
 */
import { tenantHasEntitlement } from './appEntitlements'

export function tenantHasSmsAddon(tenant) {
  return tenantHasEntitlement(tenant, { appId: 'sms_marketing', flag: 'hasSmsAddon' })
}
