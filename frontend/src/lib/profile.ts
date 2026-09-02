import { AppRole } from '../types';

export const milkFederations = [
  'Andhra Pradesh Dairy Development Cooperative Federation Ltd.',
  'Bihar State Milk Cooperative Federation Ltd. (COMFED)',
  'Chhattisgarh Rajya Sahakari Dugdh Mahasangh Maryadit',
  'Goa State Cooperative Milk Producers’ Union Ltd.',
  'Gujarat Cooperative Milk Marketing Federation Ltd. (GCMMF)',
  'Haryana Dairy Development Cooperative Federation Ltd. (HDDCF)',
  'Himachal Pradesh State Cooperative Milk Producers’ Federation Ltd.',
  'Jammu and Kashmir Dairy Corporation Federation Ltd.',
  'Jharkhand State Cooperative Milk Producers’ Federation Ltd.',
  'Karnataka Cooperative Milk Producers’ Federation Ltd. (KMF)',
  'Kerala Cooperative Milk Marketing Federation Ltd. (MILMA)',
  'Madhya Pradesh State Cooperative Dairy Federation Ltd.',
  'Maharashtra Rajya Sahakari Dudh Mahasangh Maryadit',
  'Nagaland State Dairy Cooperative Federation Ltd.',
  'Odisha State Cooperative Milk Producers’ Federation Ltd. (OMFED)',
  'Punjab State Cooperative Milk Producers’ Federation Ltd. (Milkfed Punjab)',
  'Rajasthan Cooperative Dairy Federation Ltd. (RCDF)',
  'Tamil Nadu Cooperative Milk Producers’ Federation Ltd. (Aavin)',
  'Telangana State Dairy Development Cooperative Federation Ltd.',
  'Pradeshik Cooperative Dairy Federation Ltd. (Uttar Pradesh)',
  'Uttarakhand Cooperative Dairy Federation Ltd. (UCDF)',
  'West Bengal Cooperative Milk Producers’ Federation Ltd.',
] as const;

export function normalizePhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  const withCountryCode = /^[6-9]\d{9}$/.test(compact) ? `+91${compact}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(withCountryCode)) {
    throw new Error('Enter a valid phone number with country code, for example +91 98765 43210.');
  }
  return withCountryCode;
}

export function profileAffiliation(role?: AppRole | null) {
  if (role === 'DAIRY_COOPERATIVE') return { label: 'Milk federation', required: true };
  if (role === 'VETERINARIAN') return { label: 'Hospital', required: false };
  if (role === 'ANIMAL_HEALTH_AUTHORITY' || role === 'ADMIN') {
    return { label: 'Organization', required: false };
  }
  return null;
}
