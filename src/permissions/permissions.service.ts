import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from 'src/entities/permission.entity';
import { RolePermission } from 'src/entities/role-permission.entity';
import { Role } from 'src/enums/role.enum';
import {
  ALL_PERMISSION_CODES,
  PermissionCode,
  Permissions,
} from './permission.constants';

/** Default RBAC matrix (ADMIN is implicit full access and is not stored in role_permissions). */
const ROLE_DEFAULTS: Record<Exclude<Role, Role.ADMIN>, PermissionCode[]> = {
  [Role.FINANCE]: [
    Permissions.PURCHASES_READ,
    Permissions.PURCHASES_WRITE,
    Permissions.SALES_READ,
    Permissions.ORDERS_READ,
    Permissions.ORDER_ITEMS_READ,
    Permissions.VENDORS_READ,
    Permissions.FINANCE_READ,
    Permissions.FINANCE_WRITE,
    Permissions.FILE_WRITE,
  ],
  [Role.SALES]: [
    Permissions.CUSTOMERS_READ,
    Permissions.CUSTOMERS_WRITE,
    Permissions.ORDERS_READ,
    Permissions.ORDERS_WRITE,
    Permissions.ORDER_ITEMS_READ,
    Permissions.ORDER_ITEMS_WRITE,
    Permissions.SALES_READ,
    Permissions.SALES_WRITE,
    Permissions.ITEMS_READ,
    Permissions.MASTER_READ,
    Permissions.VENDORS_READ,
    Permissions.FINANCE_READ,
    Permissions.FILE_WRITE,
  ],
  [Role.CASHIER]: [
    Permissions.CUSTOMERS_READ,
    Permissions.CUSTOMERS_WRITE,
    Permissions.ORDERS_READ,
    Permissions.ORDERS_WRITE,
    Permissions.ORDER_ITEMS_READ,
    Permissions.ORDER_ITEMS_WRITE,
    Permissions.FINANCE_READ,
    Permissions.FILE_WRITE,
    Permissions.MASTER_READ,
    Permissions.VENDORS_READ,
  ],
  [Role.PRODUCTION]: [
    Permissions.ORDERS_READ,
    Permissions.ORDER_ITEMS_READ,
    Permissions.PRODUCTION_WRITE,
    Permissions.SALES_READ,
    Permissions.ITEMS_READ,
    Permissions.BINCARD_READ,
    Permissions.BOM_READ,
    Permissions.LAB_TOOL_READ,
    Permissions.LAB_TOOL_WRITE,
    Permissions.MASTER_READ,
    Permissions.FILE_WRITE,
  ],
  [Role.STORE_KEEPER]: [
    Permissions.ORDERS_READ,
    Permissions.ORDER_ITEMS_READ,
    Permissions.SALES_READ,
    Permissions.SALES_WRITE,
    Permissions.PURCHASES_READ,
    Permissions.PURCHASES_WRITE,
    Permissions.ITEMS_READ,
    Permissions.STOCK_OPS_READ,
    Permissions.STOCK_OPS_WRITE,
    Permissions.BINCARD_READ,
    Permissions.MASTER_READ,
    Permissions.FILE_WRITE,
  ],
  [Role.QUALITY_CONTROL]: [
    Permissions.ORDERS_READ,
    Permissions.ORDER_ITEMS_READ,
    Permissions.QUALITY_CONTROL_WRITE,
  ],
};

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rpRepo: Repository<RolePermission>,
  ) {}

  async onModuleInit() {
    await this.ensureCatalog();
    await this.ensureDefaultRoleBindings();
  }

  private async ensureCatalog() {
    const existing = await this.permRepo.find();
    const codes = new Set(existing.map((p) => p.code));
    for (const code of ALL_PERMISSION_CODES) {
      if (!codes.has(code)) {
        await this.permRepo.save(
          this.permRepo.create({
            code,
            description: humanizeCode(code),
          }),
        );
      }
    }
  }

  /** First boot only: seed role_permissions from defaults. */
  private async ensureDefaultRoleBindings() {
    const n = await this.rpRepo.count();
    if (n > 0) return;

    const perms = await this.permRepo.find();
    const byCode = new Map(perms.map((p) => [p.code, p]));

    const rows: RolePermission[] = [];
    for (const role of Object.keys(ROLE_DEFAULTS) as (keyof typeof ROLE_DEFAULTS)[]) {
      for (const code of ROLE_DEFAULTS[role]) {
        const p = byCode.get(code);
        if (p) {
          rows.push(this.rpRepo.create({ role, permissionId: p.id }));
        }
      }
    }
    if (rows.length) {
      await this.rpRepo.save(rows);
    }
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permRepo.find({ order: { code: 'ASC' } });
  }

  async getCodesForRole(role: Role): Promise<string[]> {
    if (role === Role.ADMIN) {
      const all = await this.permRepo.find({ order: { code: 'ASC' } });
      return all.map((p) => p.code);
    }
    const rps = await this.rpRepo.find({
      where: { role },
      relations: ['permission'],
    });
    return rps.map((r) => r.permission.code).sort();
  }

  async roleHasPermission(role: Role, code: string): Promise<boolean> {
    if (role === Role.ADMIN) return true;
    const n = await this.rpRepo
      .createQueryBuilder('rp')
      .innerJoin('rp.permission', 'p')
      .where('rp.role = :role', { role })
      .andWhere('p.code = :code', { code })
      .getCount();
    return n > 0;
  }

  async setRolePermissions(role: Role, codes: string[]) {
    if (role === Role.ADMIN) {
      throw new BadRequestException(
        'ADMIN has full access by design; do not assign explicit permissions to ADMIN.',
      );
    }
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length === 0) {
      await this.rpRepo.delete({ role });
      return this.getCodesForRole(role);
    }
    const perms = await this.permRepo.find({
      where: { code: In(uniqueCodes) },
    });
    if (perms.length !== uniqueCodes.length) {
      const found = new Set(perms.map((p) => p.code));
      const missing = uniqueCodes.filter((c) => !found.has(c));
      throw new BadRequestException(
        `Unknown permission codes: ${missing.join(', ')}`,
      );
    }
    await this.rpRepo.delete({ role });
    await this.rpRepo.save(
      perms.map((p) => this.rpRepo.create({ role, permissionId: p.id })),
    );
    return this.getCodesForRole(role);
  }

  async getMatrix(): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    for (const role of Object.values(Role)) {
      out[role] = await this.getCodesForRole(role);
    }
    return out;
  }
}

function humanizeCode(code: string): string {
  const [resource, action] = code.split('.');
  if (!action) return code;
  return `${resource} — ${action}`;
}
