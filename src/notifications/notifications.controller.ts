import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetCurrentUserId } from 'src/decorators';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { ResponseBuilder } from 'src/common/response.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@GetCurrentUserId() userId: string, @Query() q: ListNotificationsDto) {
    const page = q.page ? Number(q.page) : 1;
    const limit = q.limit ? Number(q.limit) : 20;
    const status = q.status ?? 'all';
    const result = await this.notificationsService.listForUser(userId, {
      page,
      limit,
      status,
    });
    return ResponseBuilder.success(result);
  }

  @Get('unread-count')
  async unreadCount(@GetCurrentUserId() userId: string) {
    return ResponseBuilder.success(
      await this.notificationsService.unreadCount(userId),
    );
  }

  @Patch(':id/read')
  async markRead(@GetCurrentUserId() userId: string, @Param('id') id: string) {
    return ResponseBuilder.success(await this.notificationsService.markRead(userId, id));
  }

  @Patch('read-all')
  async markAllRead(@GetCurrentUserId() userId: string) {
    return ResponseBuilder.success(await this.notificationsService.markAllRead(userId));
  }

  @Delete(':id')
  async delete(@GetCurrentUserId() userId: string, @Param('id') id: string) {
    return ResponseBuilder.success(await this.notificationsService.delete(userId, id));
  }
}

