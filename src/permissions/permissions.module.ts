import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from 'src/entities/permission.entity';
import { RolePermission } from 'src/entities/role-permission.entity';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsController } from './permissions.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Permission, RolePermission])],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
})
export class PermissionsModule {}
