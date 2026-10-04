import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingService } from '../domain/booking.service';
import { SafetyService } from '../domain/safety.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly bookings: BookingService,
    private readonly safety: SafetyService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick().catch((error) => console.error('OVYK job failed', error));
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    await this.bookings.releaseExpiredHolds();
    await this.safety.escalate();
  }
}
