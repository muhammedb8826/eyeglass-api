import { ForbiddenException } from '@nestjs/common';
import { User } from 'src/entities/user.entity';
import { OrderItems } from 'src/entities/order-item.entity';
import { Role } from 'src/enums/role.enum';
import { Permissions } from 'src/permissions/permission.constants';
import { PermissionsService } from 'src/permissions/permissions.service';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { orderItemFieldChanged } from './order-item-workflow.guard';

/** Lab workflow statuses on an order line. */
export function statusChangeNeedsProductionPermission(
  previousStatus: string,
  nextStatus: string,
): boolean {
  if (previousStatus === nextStatus) {
    return false;
  }
  const inLab = (s: string) => s === 'InProgress' || s === 'Ready';
  if (nextStatus === 'InProgress' || nextStatus === 'Ready') {
    return true;
  }
  if (inLab(previousStatus)) {
    if (nextStatus === 'Delivered' || nextStatus === 'Pending') {
      return false;
    }
    return true;
  }
  return false;
}

const SKIP_GENERAL_SCAN = new Set([
  'id',
  'orderItemNotes',
  'status',
  'qualityControlStatus',
]);

export async function assertOrderItemPatchPermissions(
  permissionsService: PermissionsService,
  user: User,
  current: OrderItems,
  dto: UpdateOrderItemDto,
  effective: {
    nextStatus: string;
    nextQualityControlStatus: string;
    qcFailureRemake: boolean;
  },
): Promise<void> {
  if (user.roles === Role.ADMIN) {
    return;
  }

  const required = new Set<string>();

  if (
    orderItemFieldChanged(
      effective.nextQualityControlStatus,
      current.qualityControlStatus,
    )
  ) {
    required.add(Permissions.QUALITY_CONTROL_WRITE);
  }

  if (orderItemFieldChanged(effective.nextStatus, current.status)) {
    if (effective.qcFailureRemake) {
      // Pending rewind is driven by QC fail; covered by QUALITY_CONTROL_WRITE
    } else if (
      statusChangeNeedsProductionPermission(current.status, effective.nextStatus)
    ) {
      required.add(Permissions.PRODUCTION_WRITE);
    } else {
      required.add(Permissions.ORDER_ITEMS_WRITE);
    }
  }

  const cur = current as unknown as Record<string, unknown>;
  const body = dto as unknown as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (SKIP_GENERAL_SCAN.has(key)) {
      continue;
    }
    if (body[key] === undefined) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(cur, key)) {
      continue;
    }
    if (!orderItemFieldChanged(body[key], cur[key])) {
      continue;
    }
    required.add(Permissions.ORDER_ITEMS_WRITE);
  }

  for (const code of required) {
    const ok = await permissionsService.roleHasPermission(user.roles, code);
    if (!ok) {
      throw new ForbiddenException(`Missing permission for this order line update: ${code}`);
    }
  }
}
