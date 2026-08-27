import { AuthIdentity } from '../types';

export function getDashboardPath(identity: AuthIdentity | null | undefined): string {
  if (!identity?.role || identity.account_status !== 'ACTIVE') return '/pending';
  return identity.role === 'ADMIN' ? '/portal/admin' : '/dashboard';
}
