import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocStatus, DriverStatus, Role, User, VehicleCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user';
import { EMERGENCY_STAFF, Roles, STAFF } from '../common/auth';
import { DriverService } from '../domain/driver.service';
import { OpsService } from '../domain/ops.service';

class StatusDto {
  @IsEnum(DriverStatus) status!: DriverStatus;
}
class ApproveDto {
  @IsBoolean() approved!: boolean;
}
class BlockDto {
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @IsEnum(['MAINTENANCE', 'DOCUMENT'] as const) reason!: 'MAINTENANCE' | 'DOCUMENT';
  @IsOptional() @IsString() note?: string;
}
class NoteDto {
  @IsOptional() @IsString() note?: string;
}
class RefundDto {
  @IsBoolean() approve!: boolean;
}
class ReplaceDto {
  @IsOptional() @IsString() driverId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsString() reason!: string;
}
class SettingDto {
  @IsString() key!: string;
  value!: unknown;
}
class PartnerDto {
  @IsString() name!: string;
  @IsString() email!: string;
  @IsString() phone!: string;
  @IsString() @MinLength(6) password!: string;
  @IsOptional() @Type(() => Number) @IsInt() commissionPercent?: number;
}
class VehicleDto {
  @IsString() cityId!: string;
  @IsString() name!: string;
  @IsString() subtitle!: string;
  @IsEnum(VehicleCategory) category!: VehicleCategory;
  @IsString() make!: string;
  @IsString() model!: string;
  @Type(() => Number) @IsInt() modelYear!: number;
  @Type(() => Number) @IsInt() seats!: number;
  @Type(() => Number) @IsInt() luggage!: number;
  @Type(() => Number) @IsInt() dailyRate!: number;
  @IsString() registrationNo!: string;
}
class NewDriverDto {
  @IsString() name!: string;
  @IsString() phone!: string;
  @IsString() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsString() licenceNumber!: string;
  @IsString() licenceExpiry!: string;
  languages!: string[];
  @Type(() => Number) @IsInt() experienceYears!: number;
  @IsString() cityId!: string;
}
class DocDto {
  @IsEnum(DocStatus) status!: DocStatus;
}
class CityDto {
  @IsBoolean() active!: boolean;
}
class HideDto {
  @IsBoolean() hidden!: boolean;
}

@ApiTags('operations')
@ApiBearerAuth()
@Controller()
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly drivers: DriverService,
  ) {}

  @Roles(...STAFF, Role.PARTNER)
  @Get('ops/summary')
  summary() {
    return this.ops.summary();
  }

  @Roles(...STAFF, Role.PARTNER)
  @Get('ops/bookings')
  bookings(@CurrentUser() user: User) {
    return this.ops.bookings(user);
  }

  @Roles(...STAFF)
  @Get('ops/customers')
  customers() {
    return this.ops.customers();
  }

  @Roles(...STAFF, Role.PARTNER)
  @Get('ops/fleet')
  fleet(@CurrentUser() user: User) {
    return this.ops.fleet(user);
  }

  @Roles(Role.ADMIN, Role.FLEET_MANAGER, Role.PARTNER_MANAGER)
  @Post('ops/drivers/:id/status')
  driverStatus(@CurrentUser() user: User, @Param('id') id: string, @Body() body: StatusDto) {
    return this.ops.setDriverStatus(user, id, body.status);
  }

  @Roles(Role.ADMIN, Role.FLEET_MANAGER)
  @Post('ops/vehicles/:id/approval')
  approveVehicle(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ApproveDto) {
    return this.ops.approveVehicle(user, id, body.approved);
  }

  @Roles(Role.ADMIN, Role.FLEET_MANAGER, Role.PARTNER)
  @Post('ops/vehicles/:id/blocks')
  block(@Param('id') id: string, @Body() body: BlockDto) {
    return this.ops.blockVehicle(id, body.startAt, body.endAt, body.reason, body.note);
  }

  @Roles(...EMERGENCY_STAFF)
  @Get('ops/emergencies')
  emergencies() {
    return this.ops.emergencies();
  }

  @Roles(...EMERGENCY_STAFF)
  @Post('ops/emergencies/:id/:action')
  act(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('action') action: 'acknowledge' | 'dispatch' | 'resolve' | 'confirm-cancel',
    @Body() body: NoteDto,
  ) {
    return this.ops.emergencyAct(user, id, action, body.note);
  }

  @Roles(Role.ADMIN, Role.FINANCE)
  @Get('ops/refunds')
  refunds() {
    return this.ops.refunds();
  }

  @Roles(Role.ADMIN, Role.FINANCE)
  @Post('ops/refunds/:id')
  refund(@CurrentUser() user: User, @Param('id') id: string, @Body() body: RefundDto) {
    return this.ops.decideRefund(user, id, body.approve);
  }

  @Roles(Role.ADMIN, Role.FINANCE)
  @Get('ops/payments.csv')
  @Header('Content-Type', 'text/csv')
  csv() {
    return this.ops.paymentsCsv();
  }

  @Roles(Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER)
  @Post('ops/bookings/:id/replace')
  replace(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ReplaceDto) {
    return this.drivers.replace(user, id, body);
  }

  @Roles(Role.ADMIN, Role.SUPPORT)
  @Post('ops/reviews/:id')
  moderate(@CurrentUser() user: User, @Param('id') id: string, @Body() body: HideDto) {
    return this.ops.moderateReview(user, id, body.hidden);
  }

  @Roles(Role.ADMIN, Role.SUPPORT)
  @Get('ops/complaints')
  complaints() {
    return this.ops.complaints();
  }

  @Roles(Role.ADMIN)
  @Get('ops/audit')
  audit() {
    return this.ops.audit();
  }

  @Roles(Role.ADMIN)
  @Post('ops/settings')
  setting(@CurrentUser() user: User, @Body() body: SettingDto) {
    return this.ops.saveSetting(user, body.key, body.value);
  }

  @Roles(Role.ADMIN, Role.PARTNER_MANAGER)
  @Post('ops/partners')
  partner(@CurrentUser() user: User, @Body() body: PartnerDto) {
    return this.ops.registerPartner(user, body);
  }

  @Roles(Role.ADMIN, Role.PARTNER_MANAGER)
  @Post('ops/partners/:id/approve')
  approvePartner(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ops.approvePartner(user, id);
  }

  @Roles(Role.PARTNER)
  @Post('partner/vehicles')
  submitVehicle(@CurrentUser() user: User, @Body() body: VehicleDto) {
    return this.ops.submitVehicle(user, body);
  }

  @Roles(Role.PARTNER)
  @Post('partner/drivers')
  submitDriver(@CurrentUser() user: User, @Body() body: NewDriverDto) {
    return this.ops.submitDriver(user, body);
  }

  @Roles(...STAFF, Role.PARTNER)
  @Get('ops/settlements')
  settlements(@CurrentUser() user: User) {
    return this.ops.settlements(user);
  }

  @Roles(Role.ADMIN)
  @Get('ops/cities')
  cities() {
    return this.ops.cities();
  }

  @Roles(Role.ADMIN)
  @Post('ops/cities/:id')
  city(@Param('id') id: string, @Body() body: CityDto) {
    return this.ops.setCity(id, body.active);
  }

  @Roles(...STAFF, Role.PARTNER)
  @Get('ops/documents/:ownerType/:ownerId')
  documents(@Param('ownerType') ownerType: string, @Param('ownerId') ownerId: string) {
    return this.ops.documents(ownerType, ownerId);
  }

  @Roles(Role.ADMIN, Role.FLEET_MANAGER)
  @Post('ops/documents/:id')
  reviewDoc(@CurrentUser() user: User, @Param('id') id: string, @Body() body: DocDto) {
    return this.ops.reviewDocument(user, id, body.status);
  }
}
