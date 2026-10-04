import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingType, EmergencyType, PaymentKind, PaymentMethod, ShareScope, User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user';
import { BookingService } from '../domain/booking.service';
import { ProfileService } from '../domain/profile.service';
import { SafetyService } from '../domain/safety.service';

class QuoteDto {
  @IsString() citySlug!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string;
  @Matches(/^\d{2}:\d{2}$/) pickupTime!: string;
  @IsEnum(BookingType) type!: BookingType;
  @Type(() => Number) @IsInt() @Min(1) @Max(14) passengers!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(16) luggage!: number;
  @IsOptional() @IsString() promoCode?: string;
}

class CreateBookingDto extends QuoteDto {
  @IsString() vehicleId!: string;
  @IsString() pickupLabel!: string;
  @IsOptional() @IsNumber() pickupLat?: number;
  @IsOptional() @IsNumber() pickupLng?: number;
  @IsOptional() @IsString() pickupKind?: string;
  @IsOptional() @IsString() flightNumber?: string;
  @IsOptional() @IsBoolean() childSeat?: boolean;
  @IsOptional() @IsBoolean() accessibility?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() passengerId?: string;
  @IsOptional() @IsString() preferredDriverId?: string;
}

class PayDto {
  @IsEnum(PaymentKind) kind!: PaymentKind;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsString() @MinLength(8) idempotencyKey!: string;
  @IsOptional() @IsBoolean() termsAccepted?: boolean;
  @IsOptional() @IsBoolean() simulateFailure?: boolean;
}

class CancelDto {
  @IsString() reason!: string;
}

class ChangeDto {
  @IsString() kind!: string;
  @IsOptional() endDate?: string;
  @IsOptional() pickupLabel?: string;
  @IsOptional() @IsNumber() hours?: number;
  @IsOptional() @IsNumber() km?: number;
  @IsOptional() destination?: string;
}

class SosDto {
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsBoolean() silent?: boolean;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsEnum(EmergencyType) type?: EmergencyType;
}

class ShareDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsEnum(ShareScope) scope!: ShareScope;
  @Type(() => Number) @IsInt() @Min(1) @Max(24 * 40) hours!: number;
  @IsOptional() @IsBoolean() notifyPickup?: boolean;
  @IsOptional() @IsBoolean() notifyArrival?: boolean;
  @IsOptional() @IsBoolean() notifyComplete?: boolean;
}

class MessageDto {
  @IsString() @MinLength(1) body!: string;
  @IsIn(['CONCIERGE', 'DRIVER']) channel!: 'CONCIERGE' | 'DRIVER';
}

class ReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) overall!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) comfort?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) cleanliness?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) punctuality?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) professionalism?: number;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsBoolean() complaint?: boolean;
}

class TipDto {
  @Type(() => Number) @IsInt() @Min(1) amountBdt!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsString() idempotencyKey!: string;
}

class AddressDto {
  @IsString() label!: string;
  @IsString() line!: string;
  @IsString() kind!: string;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

class PassengerDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() relationship?: string;
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('customer')
@ApiBearerAuth()
@Controller()
export class CustomerController {
  constructor(
    private readonly bookings: BookingService,
    private readonly safety: SafetyService,
    private readonly profiles: ProfileService,
  ) {}

  @Get('cities')
  cities() {
    return this.profiles.cities();
  }

  @Get('cities/:slug/places')
  places(@Param('slug') slug: string) {
    return this.profiles.places(slug);
  }

  @Post('quotes')
  quote(@Body() body: QuoteDto) {
    return this.bookings.quote(body);
  }

  @Post('bookings')
  create(@CurrentUser() user: User, @Body() body: CreateBookingDto) {
    return this.bookings.create(user, body);
  }

  @Get('bookings')
  mine(@CurrentUser() user: User) {
    return this.bookings.mine(user);
  }

  @Get('bookings/:id')
  one(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookings.open(user, id);
  }

  @Post('bookings/:id/hold')
  hold(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookings.hold(user, id);
  }

  @Post('bookings/:id/pay')
  pay(@CurrentUser() user: User, @Param('id') id: string, @Body() body: PayDto) {
    return this.bookings.pay(user, id, body);
  }

  @Post('bookings/:id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string, @Body() body: CancelDto) {
    return this.bookings.cancel(user, id, body.reason);
  }

  @Post('bookings/:id/changes')
  change(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ChangeDto) {
    const { kind, ...payload } = body;
    return this.bookings.quoteChange(user, id, kind, payload);
  }

  @Post('bookings/:id/changes/:amendmentId/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string, @Param('amendmentId') amendmentId: string) {
    return this.bookings.acceptChange(user, id, amendmentId);
  }

  @Get('invoices/:id/pdf')
  async invoice(@CurrentUser() user: User, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.bookings.invoicePdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ovyk-${id}.pdf"`);
    res.send(pdf);
  }

  @Get('bookings/:id/tracking')
  track(@CurrentUser() user: User, @Param('id') id: string) {
    return this.safety.track(user, id);
  }

  @Post('bookings/:id/shares')
  share(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ShareDto) {
    return this.safety.share(user, id, body);
  }

  @Delete('shares/:id')
  revoke(@CurrentUser() user: User, @Param('id') id: string) {
    return this.safety.revokeShare(user, id);
  }

  @Post('emergencies')
  sos(@CurrentUser() user: User, @Body() body: SosDto) {
    return this.safety.sos(user, body);
  }

  @Get('emergencies')
  mySos(@CurrentUser() user: User) {
    return this.safety.myEmergencies(user);
  }

  @Post('emergencies/:id/type')
  sosType(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { type: EmergencyType }) {
    return this.safety.setSosType(user, id, body.type);
  }

  @Post('emergencies/:id/cancel')
  sosCancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.safety.cancelSos(user, id);
  }

  @Get('bookings/:id/messages')
  messages(@CurrentUser() user: User, @Param('id') id: string) {
    return this.safety.messages(user, id);
  }

  @Post('bookings/:id/messages')
  message(@CurrentUser() user: User, @Param('id') id: string, @Body() body: MessageDto) {
    return this.safety.postMessage(user, id, body.body, body.channel);
  }

  @Post('bookings/:id/review')
  review(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ReviewDto) {
    return this.safety.review(user, id, body);
  }

  @Post('bookings/:id/tip')
  tip(@CurrentUser() user: User, @Param('id') id: string, @Body() body: TipDto) {
    return this.safety.tip(user, id, body.amountBdt, body.method, body.idempotencyKey);
  }

  @Get('addresses')
  addresses(@CurrentUser() user: User) {
    return this.profiles.addresses(user);
  }

  @Post('addresses')
  addAddress(@CurrentUser() user: User, @Body() body: AddressDto) {
    return this.profiles.addAddress(user, body);
  }

  @Delete('addresses/:id')
  removeAddress(@CurrentUser() user: User, @Param('id') id: string) {
    return this.profiles.removeAddress(user, id);
  }

  @Get('passengers')
  passengers(@CurrentUser() user: User) {
    return this.profiles.passengers(user);
  }

  @Post('passengers')
  addPassenger(@CurrentUser() user: User, @Body() body: PassengerDto) {
    return this.profiles.addPassenger(user, body);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: User) {
    return this.profiles.notifications(user);
  }

  @Post('notifications/:id/read')
  read(@CurrentUser() user: User, @Param('id') id: string) {
    return this.profiles.readNotification(user, id);
  }
}
