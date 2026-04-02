import { IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  /** Empty array clears all permissions for that role (except ADMIN, which cannot be edited). */
  @IsArray()
  @IsString({ each: true })
  codes: string[];
}
