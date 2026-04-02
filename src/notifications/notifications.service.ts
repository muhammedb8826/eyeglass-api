import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from 'src/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async notify(input: {
    recipientId: string;
    type: NotificationType;
    title: string;
    message?: string | null;
    data?: any;
  }) {
    const row = this.notificationRepository.create({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      data: input.data ?? null,
      isRead: false,
      readAt: null,
    });
    return this.notificationRepository.save(row);
  }

  async listForUser(
    recipientId: string,
    opts?: { page?: number; limit?: number; status?: 'all' | 'unread' | 'read' },
  ) {
    const page = Math.max(1, Number(opts?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts?.limit ?? 20)));
    const skip = (page - 1) * limit;

    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.recipientId = :recipientId', { recipientId })
      .orderBy('n.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (opts?.status === 'unread') qb.andWhere('n.isRead = false');
    if (opts?.status === 'read') qb.andWhere('n.isRead = true');

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async unreadCount(recipientId: string) {
    const count = await this.notificationRepository.count({
      where: { recipientId, isRead: false },
    });
    return { unread: count };
  }

  async markRead(recipientId: string, id: string) {
    const n = await this.notificationRepository.findOne({
      where: { id, recipientId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.isRead) {
      n.isRead = true;
      n.readAt = new Date();
      await this.notificationRepository.save(n);
    }
    return n;
  }

  async markAllRead(recipientId: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'CURRENT_TIMESTAMP' })
      .where('recipientId = :recipientId', { recipientId })
      .andWhere('isRead = false')
      .execute();
    return this.unreadCount(recipientId);
  }

  async delete(recipientId: string, id: string) {
    const n = await this.notificationRepository.findOne({
      where: { id, recipientId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    await this.notificationRepository.remove(n);
    return { message: 'Notification deleted' };
  }
}

