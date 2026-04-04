import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** User must have at least one of these codes (OR). Combined with {@link PERMISSIONS_KEY} as AND. */
export const PERMISSIONS_ANY_KEY = 'permissionsAny';

/** Require all listed permission codes (AND). ADMIN role bypasses in PermissionsGuard. */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

/** Require at least one listed permission code (OR). Still AND with class-level {@link RequirePermissions}. ADMIN bypasses. */
export const RequireAnyPermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, codes);
