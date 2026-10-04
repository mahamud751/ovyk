import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './common/auth';
import { BookingService } from './domain/booking.service';
import { DriverService } from './domain/driver.service';
import { OpsService } from './domain/ops.service';
import { ProfileService } from './domain/profile.service';
import { SafetyService } from './domain/safety.service';
import { CustomerController } from './http/customer.controller';
import { DriverController } from './http/driver.controller';
import { OpsController } from './http/ops.controller';
import { PublicController } from './http/public.controller';
import { JobsService } from './jobs/jobs.service';
import { NotifyService } from './notify/notify.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  controllers: [CustomerController, DriverController, OpsController, PublicController],
  providers: [
    BookingService,
    SafetyService,
    DriverService,
    OpsService,
    ProfileService,
    NotifyService,
    JobsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
