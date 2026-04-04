/**
 * Dot-notation permission codes: resource.action
 * Aligns with common RBAC naming (e.g. users.manage, orders.read).
 */
export const Permissions = {
  USERS_MANAGE: 'users.manage',
  PERMISSIONS_MANAGE: 'permissions.manage',

  ORDERS_READ: 'orders.read',
  ORDERS_WRITE: 'orders.write',

  ORDER_ITEMS_READ: 'order_items.read',
  ORDER_ITEMS_WRITE: 'order_items.write',

  /** Line status InProgress / Ready and related lab transitions (not cashier delivery). */
  PRODUCTION_WRITE: 'production.write',

  /** Set order line `qualityControlStatus` (Passed / Failed / Pending). */
  QUALITY_CONTROL_WRITE: 'quality_control.write',

  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',

  ITEMS_READ: 'items.read',
  ITEMS_WRITE: 'items.write',

  PURCHASES_READ: 'purchases.read',
  PURCHASES_WRITE: 'purchases.write',

  SALES_READ: 'sales.read',
  SALES_WRITE: 'sales.write',

  BINCARD_READ: 'bincard.read',

  PRICING_READ: 'pricing.read',
  PRICING_WRITE: 'pricing.write',

  VENDORS_READ: 'vendors.read',
  VENDORS_WRITE: 'vendors.write',

  /** Shared master data: machines, services, UOM, unit categories, sales partners, non-stock services, user–machine */
  MASTER_READ: 'master.read',
  MASTER_WRITE: 'master.write',

  BOM_READ: 'bom.read',
  BOM_WRITE: 'bom.write',

  LAB_TOOL_READ: 'lab_tool.read',
  LAB_TOOL_WRITE: 'lab_tool.write',

  FINANCE_READ: 'finance.read',
  FINANCE_WRITE: 'finance.write',

  STOCK_OPS_READ: 'stock_ops.read',
  STOCK_OPS_WRITE: 'stock_ops.write',

  FILE_WRITE: 'file.write',
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSION_CODES = Object.values(Permissions) as PermissionCode[];
