import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Put,
} from '@nestjs/common';
import { GetCurrentUser } from 'src/decorators';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { SkipPermissions } from 'src/decorators/skip-permissions.decorator';
import { PermissionsService } from './permissions.service';
import { Permissions } from './permission.constants';
import { Role } from 'src/enums/role.enum';
import { User } from 'src/entities/user.entity';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /** Full permission catalog (for admin UI / documentation). */
  @Get()
  @SkipPermissions()
  listCatalog() {
    return this.permissionsService.findAllPermissions();
  }

  /** Current user’s effective permission codes (for FE menus and guards). */
  @Get('me')
  @SkipPermissions()
  async myPermissions(@GetCurrentUser() user: User) {
    const permissions = await this.permissionsService.getCodesForRole(user.roles);
    return { role: user.roles, permissions };
  }

  @Get('matrix')
  @RequirePermissions(Permissions.PERMISSIONS_MANAGE)
  matrix() {
    return this.permissionsService.getMatrix();
  }

  @Get('roles/:role')
  @RequirePermissions(Permissions.PERMISSIONS_MANAGE)
  byRole(@Param('role', new ParseEnumPipe(Role)) role: Role) {
    return this.permissionsService.getCodesForRole(role);
  }

  @Put('roles/:role')
  @RequirePermissions(Permissions.PERMISSIONS_MANAGE)
  async setRole(
    @Param('role', new ParseEnumPipe(Role)) role: Role,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    const permissions = await this.permissionsService.setRolePermissions(
      role,
      dto.codes,
    );
    return { role, permissions };
  }
}
