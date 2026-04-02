import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/enums/role.enum';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';
import { SKIP_PERMISSIONS_KEY } from 'src/decorators/skip-permissions.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skipPermissions = this.reflector.getAllAndOverride<boolean>(
      SKIP_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipPermissions) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { user } = context.switchToHttp().getRequest();

    if (!required?.length) {
      if (user) {
        throw new ForbiddenException(
          'This route is not assigned any permission. Use @RequirePermissions, @Public, or @SkipPermissions.',
        );
      }
      return true;
    }

    if (!user?.roles) {
      throw new ForbiddenException('Missing user role');
    }

    if (user.roles === Role.ADMIN) {
      return true;
    }

    for (const code of required) {
      const ok = await this.permissionsService.roleHasPermission(user.roles, code);
      if (!ok) {
        throw new ForbiddenException(`Missing permission: ${code}`);
      }
    }
    return true;
  }
}
