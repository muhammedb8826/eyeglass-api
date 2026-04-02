import { ConflictException } from '@nestjs/common';
import { OrderItems } from 'src/entities/order-item.entity';

/** Payload keys allowed when line is approved or in production (workflow only). */
export const ORDER_ITEM_WORKFLOW_PATCH_KEYS = new Set([
  'storeRequestStatus',
  'operatorId',
  'status',
  'qualityControlStatus',
  'orderId',
  'approvalStatus',
  'adminApproval',
  'id',
]);

export function orderItemFieldChanged(incoming: unknown, current: unknown): boolean {
  if (incoming === undefined) {
    return false;
  }
  if (incoming === null && (current === null || current === undefined)) {
    return false;
  }
  if (typeof incoming === 'number' || typeof current === 'number') {
    const ni = Number(incoming);
    const nc = Number(current);
    if (Number.isNaN(ni) && Number.isNaN(nc)) {
      return false;
    }
    return ni !== nc;
  }
  if (typeof incoming === 'boolean' || typeof current === 'boolean') {
    return Boolean(incoming) !== Boolean(current);
  }
  return String(incoming ?? '') !== String(current ?? '');
}

/**
 * Reject structural edits when the line or order is past the editable stage.
 * Call when: line is Approved, or line status is InProgress/Ready, or order status is InProgress/Ready.
 */
export function assertWorkflowOnlyOrderItemPayload(
  dto: Record<string, unknown>,
  current: OrderItems,
): void {
  for (const key of Object.keys(dto)) {
    if (ORDER_ITEM_WORKFLOW_PATCH_KEYS.has(key)) {
      if (key === 'orderId' && dto.orderId !== undefined) {
        if (String(dto.orderId) !== String(current.orderId)) {
          throw new ConflictException(
            'Cannot move an order item to another order after it is approved or in production.',
          );
        }
      }
      continue;
    }
    const incoming = dto[key];
    if (incoming === undefined) {
      continue;
    }
    // Not a persisted column on the line; clients often send [] on bulk order PATCH — ignore.
    if (key === 'orderItemNotes') {
      continue;
    }
    const cur = (current as unknown as Record<string, unknown>)[key];
    if (!orderItemFieldChanged(incoming, cur)) {
      continue;
    }
    throw new ConflictException(
      `Cannot edit "${key}" after the line is approved or the order is in production. Only workflow fields (e.g. storeRequestStatus, operatorId, status, qualityControlStatus, approvalStatus) may be updated.`,
    );
  }
}
