import { IsIn, IsNumberString, IsOptional } from 'class-validator';

export class ListNotificationsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  /** "all" (default), "unread", "read" */
  @IsOptional()
  @IsIn(['all', 'unread', 'read'])
  status?: 'all' | 'unread' | 'read';
}

