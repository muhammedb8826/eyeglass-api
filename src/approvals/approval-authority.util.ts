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
 * Sale/store-request line: Approved → Stocked-out is normal fulfillment after approval.
 * Not an approval revocation; `approvals.manage` is not required (stock issue uses stock_ops.write).
 */
export function isStoreRequestLineApprovalToStockIssue(
  prevStatus: string,
  nextStatus: string,
): boolean {
  return isApprovedLabel(prevStatus) && nextStatus === 'Stocked-out';
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

/** True when a store-request line moves into or out of Stocked-out (physical issue / reversal). */
export function isSaleItemStockIssueTransition(
  prevStatus: string,
  nextStatus: string,
): boolean {
  return (
    (prevStatus !== 'Stocked-out' && nextStatus === 'Stocked-out') ||
    (prevStatus === 'Stocked-out' && nextStatus !== 'Stocked-out')
  );
}

/** True when a purchase line moves into or out of Received (stock IN / receipt reversal). */
export function isPurchaseItemInventoryTransition(
  prevStatus: string,
  nextStatus: string,
): boolean {
  return (
    (prevStatus !== 'Received' && nextStatus === 'Received') ||
    (prevStatus === 'Received' && nextStatus !== 'Received')
  );
}

async function assertHasStockOpsWrite(
  permissionsService: PermissionsService,
  user: User | null | undefined,
  ifMissingUser: string,
  ifDenied: string,
): Promise<void> {
  if (!user) {
    throw new ForbiddenException(ifMissingUser);
  }
  if (user.roles === Role.ADMIN) {
    return;
  }
  const ok = await permissionsService.roleHasPermission(
    user.roles,
    Permissions.STOCK_OPS_WRITE,
  );
  if (!ok) {
    throw new ForbiddenException(ifDenied);
  }
}

/** Store issue from main stock: only ADMIN or stock_ops.write (e.g. store keeper). */
export async function assertCanPerformStoreStockIssue(
  permissionsService: PermissionsService,
  user: User | null | undefined,
): Promise<void> {
  await assertHasStockOpsWrite(
    permissionsService,
    user,
    'Sign in is required to issue or reverse store request stock (sale line Stocked-out).',
    'Only ADMIN or users with stock_ops.write may set or clear Stocked-out on store request lines.',
  );
}

/** Receive approved PO lines into inventory (or reverse): only ADMIN or stock_ops.write. */
export async function assertCanReceivePurchaseIntoStock(
  permissionsService: PermissionsService,
  user: User | null | undefined,
): Promise<void> {
  await assertHasStockOpsWrite(
    permissionsService,
    user,
    'Sign in is required to receive purchase lines into stock or reverse receipt.',
    'Only ADMIN or users with stock_ops.write may receive purchase lines into inventory or reverse receipt.',
  );
}
