import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** Require all listed permission codes (AND). ADMIN role bypasses in PermissionsGuard. */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
