import { ConflictException } from '@nestjs/common';

/**
 * Retail handoff: Ready → SentToShop → ShopReceived → Delivered.
 * Also enforces QC Passed before shop / delivery.
 */
export function assertOrderLineFulfillmentStatusChain(params: {
  previousStatus: string;
  previousQc: string;
  nextStatus: string;
  nextQc: string;
}): void {
  const { previousStatus, nextStatus, nextQc } = params;

  if (nextStatus === previousStatus) {
    return;
  }

  if (nextStatus === 'SentToShop') {
    if (previousStatus !== 'Ready') {
      throw new ConflictException(
        'Cannot send to shop: line status must be "Ready" first.',
      );
    }
    if (nextQc !== 'Passed') {
      throw new ConflictException(
        'Cannot send to shop: quality control must be "Passed" first.',
      );
    }
  }
  if (nextStatus === 'ShopReceived') {
    if (previousStatus !== 'SentToShop') {
      throw new ConflictException(
        'Cannot mark shop received: line status must be "SentToShop" first.',
      );
    }
  }
  if (nextStatus === 'Delivered') {
    if (nextQc !== 'Passed') {
      throw new ConflictException(
        'Cannot deliver item: quality control must be "Passed" before delivery.',
      );
    }
    if (previousStatus !== 'ShopReceived') {
      throw new ConflictException(
        'Cannot deliver item: line status must be "ShopReceived" first (flow: Ready → SentToShop → ShopReceived → Delivered).',
      );
    }
  }
}
