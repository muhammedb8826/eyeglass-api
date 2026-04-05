import { ForbiddenException } from '@nestjs/common';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/enums/role.enum';
import { Permissions } from 'src/permissions/permission.constants';
import { PermissionsService } from 'src/permissions/permissions.service';

/** Case-insensitive match for workflow label "Approved" on orders, POs, store requests, etc. */
export function isApprovedLabel(value: string | undefined | null): boolean {
  return (value ?? '').trim().toLowerCase() === 'approved';
}

/**
 * Order / purchase / store-request (sale) approvals: only ADMIN or explicit `approvals.manage`.
 */
export async function assertCanManageApprovals(
  permissionsService: PermissionsService,
  user: User | null | undefined,
  context: string,
): Promise<void> {
  if (!user) {
    throw new ForbiddenException(
      `${context}: sign in is required. Only ADMIN or users with permission "${Permissions.APPROVALS_MANAGE}" may approve or revoke approval.`,
    );
  }
  if (user.roles === Role.ADMIN) {
    return;
  }
  const ok = await permissionsService.roleHasPermission(
    user.roles,
    Permissions.APPROVALS_MANAGE,
  );
  if (!ok) {
    throw new ForbiddenException(
      `${context}: only ADMIN or users with permission "${Permissions.APPROVALS_MANAGE}" may approve or revoke approval.`,
    );
  }
}
