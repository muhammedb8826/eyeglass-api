import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Item } from 'src/entities/item.entity';
import { ItemBase } from 'src/entities/item-base.entity';

export async function countItemBases(
  manager: EntityManager,
  itemId: string,
): Promise<number> {
  return manager.count(ItemBase, { where: { itemId } });
}

/** After any ItemBase quantity change, keep parent Item.quantity as sum of variant quantities. */
export async function syncParentItemQuantityFromBases(
  manager: EntityManager,
  itemId: string,
): Promise<void> {
  const bases = await manager.find(ItemBase, { where: { itemId } });
  if (bases.length === 0) return;
  const total = bases.reduce((sum, b) => sum + Number(b.quantity ?? 0), 0);
  await manager.update(Item, { id: itemId }, { quantity: total });
}

/**
 * Enforces itemBaseId when the item has variants, and forbids it when it does not.
 */
export async function assertItemVariantLineFields(
  manager: EntityManager,
  itemId: string,
  itemBaseId: string | null | undefined,
): Promise<{ normalizedItemBaseId: string | null }> {
  const item = await manager.findOne(Item, {
    where: { id: itemId },
    select: ['id', 'name'],
  });
  if (!item) {
    throw new NotFoundException(`Item with ID ${itemId} not found`);
  }
  const baseCount = await countItemBases(manager, itemId);
  if (baseCount > 0) {
    if (!itemBaseId) {
      throw new BadRequestException(
        `itemBaseId is required for "${item.name}" because stock is tracked per base/ADD variant.`,
      );
    }
    const base = await manager.findOne(ItemBase, {
      where: { id: itemBaseId, itemId },
    });
    if (!base) {
      throw new BadRequestException(
        'itemBaseId does not belong to this item or was not found.',
      );
    }
    return { normalizedItemBaseId: base.id };
  }
  if (itemBaseId) {
    throw new BadRequestException(
      `This item does not use base/ADD variants; omit itemBaseId (item "${item.name}").`,
    );
  }
  return { normalizedItemBaseId: null };
}

/**
 * Stock availability for a Requested sale line. Call after assertItemVariantLineFields.
 */
export async function assertSaleRequestedAvailability(
  manager: EntityManager,
  itemId: string,
  itemBaseId: string | null | undefined,
  unit: number,
): Promise<void> {
  const item = await manager.findOne(Item, {
    where: { id: itemId },
    select: ['id', 'quantity', 'name'],
  });
  if (!item) {
    throw new NotFoundException(`Item with ID ${itemId} not found`);
  }
  const baseCount = await countItemBases(manager, itemId);
  if (baseCount > 0) {
    const base = await manager.findOne(ItemBase, {
      where: { id: itemBaseId as string, itemId },
    });
    if (!base) {
      throw new BadRequestException(
        'itemBaseId does not belong to this item or was not found.',
      );
    }
    if (Number(base.quantity ?? 0) < unit) {
      throw new ConflictException(
        `Requested quantity exceeds available stock for this variant on item "${item.name}".`,
      );
    }
    return;
  }
  if (Number(item.quantity ?? 0) < unit) {
    throw new ConflictException(
      `Requested quantity is more than available quantity for item "${item.name}"`,
    );
  }
}

/**
 * Apply stock delta: negative for issue/out, positive for receipt/in.
 * Uses ItemBase when the item has any bases; otherwise Item.quantity.
 */
export async function applyInventoryDelta(
  manager: EntityManager,
  itemId: string,
  itemBaseId: string | null | undefined,
  delta: number,
): Promise<{ balanceAfter: number; usedVariant: boolean }> {
  const item = await manager.findOne(Item, { where: { id: itemId } });
  if (!item) {
    throw new NotFoundException(`Item with ID ${itemId} not found`);
  }

  const baseCount = await countItemBases(manager, itemId);
  if (baseCount > 0) {
    if (!itemBaseId) {
      throw new BadRequestException(
        'itemBaseId is required when moving stock for materials with base/ADD variants.',
      );
    }
    const base = await manager.findOne(ItemBase, {
      where: { id: itemBaseId, itemId },
    });
    if (!base) {
      throw new NotFoundException('Variant not found for this item.');
    }
    const prev = Number(base.quantity ?? 0);
    const next = prev + delta;
    if (next < 0) {
      throw new ConflictException('Insufficient stock at this base/ADD variant.');
    }
    await manager.update(ItemBase, { id: base.id }, { quantity: next });
    await syncParentItemQuantityFromBases(manager, itemId);
    return { balanceAfter: next, usedVariant: true };
  }

  if (itemBaseId) {
    throw new BadRequestException(
      'This item does not use variants; omit itemBaseId for stock movements.',
    );
  }
  const prev = Number(item.quantity ?? 0);
  const next = prev + delta;
  if (next < 0) {
    throw new ConflictException('Insufficient stock for this item.');
  }
  await manager.update(Item, { id: itemId }, { quantity: next });
  return { balanceAfter: next, usedVariant: false };
}
