import { SetMetadata } from '@nestjs/common';

/** Allow any authenticated user (no permission check). Use for /account, /notifications, etc. */
export const SKIP_PERMISSIONS_KEY = 'skipPermissions';

export const SkipPermissions = () => SetMetadata(SKIP_PERMISSIONS_KEY, true);
