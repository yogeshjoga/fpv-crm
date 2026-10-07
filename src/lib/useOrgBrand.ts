import { supabase } from './supabase';
import { useQuery } from './useQuery';
import type { OrgBrand } from './offerPdf';

export interface OrgBrandInfo extends OrgBrand {
  signatoryName: string;
}

/** Company name, logo, signature and seal, as set under Settings. Used on letters and reports. */
export async function fetchOrgBrand(): Promise<OrgBrandInfo> {
  const { data } = await supabase.from('org_settings').select('org_name, logo_url, signatory_name, signatory_image_url, company_seal_url').single();
  return {
    orgName: data?.org_name || 'EgireRobotics',
    logoUrl: data?.logo_url ?? null,
    signatureUrl: data?.signatory_image_url ?? null,
    sealUrl: data?.company_seal_url ?? null,
    signatoryName: data?.signatory_name ?? '',
  };
}

export function useOrgBrand() {
  return useQuery(fetchOrgBrand, []);
}
