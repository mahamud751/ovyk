import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotifyService {
  constructor(private readonly prisma: PrismaService) {}

  async send(userId: string, title: string, body: string, bookingId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return;
    const channels: NotificationChannel[] = [NotificationChannel.IN_APP];
    if (user.notifyPush) channels.push(NotificationChannel.PUSH);
    if (user.notifyEmail && user.email) channels.push(NotificationChannel.EMAIL);
    if (user.notifySms && user.phone) channels.push(NotificationChannel.SMS);
    await this.prisma.notification.createMany({
      data: channels.map((channel) => ({ userId, title, body, bookingId, channel })),
    });
  }
}
