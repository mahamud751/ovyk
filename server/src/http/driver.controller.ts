import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LocationSource, Role, User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../auth/current-user';
import { Roles } from '../common/auth';
import { DriverService } from '../domain/driver.service';
import { SafetyService } from '../domain/safety.service';

class AdvanceDto {
  @IsOptional() @Type(() => Number) @IsNumber() hoursUsed?: number;
  @IsOptional() @Type(() => Number) @IsNumber() kmUsed?: number;
}

class ExpenseDto {
  @IsString() kind!: string;
  @Type(() => Number) @IsNumber() amountBdt!: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() evidenceNote?: string;
}

class InspectDto {
  @IsBoolean() cleanliness!: boolean;
  @IsBoolean() exteriorOk!: boolean;
  @IsBoolean() interiorOk!: boolean;
  @IsOptional() @IsString() notes?: string;
}

class IssueDto {
  @IsString() kind!: string;
  @IsString() note!: string;
}

class PingDto {
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsEnum(LocationSource) source?: LocationSource;
}

@ApiTags('driver')
@ApiBearerAuth()
@Roles(Role.DRIVER, Role.ADMIN)
@Controller('driver')
export class DriverController {
  constructor(
    private readonly drivers: DriverService,
    private readonly safety: SafetyService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.drivers.me(user);
  }

  @Get('assignments')
  assignments(@CurrentUser() user: User) {
    return this.drivers.assignments(user);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: User) {
    return this.drivers.earnings(user);
  }

  @Post('assignments/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.drivers.accept(user, id);
  }

  @Post('journeys/:id/advance')
  advance(@CurrentUser() user: User, @Param('id') id: string, @Body() body: AdvanceDto) {
    return this.drivers.advance(user, id, body.hoursUsed, body.kmUsed);
  }

  @Post('assignments/:id/expenses')
  expense(@CurrentUser() user: User, @Param('id') id: string, @Body() body: ExpenseDto) {
    return this.drivers.expense(user, id, body);
  }

  @Post('assignments/:id/inspection')
  inspect(@CurrentUser() user: User, @Param('id') id: string, @Body() body: InspectDto) {
    return this.drivers.inspect(user, id, body);
  }

  @Post('assignments/:id/issues')
  issue(@CurrentUser() user: User, @Param('id') id: string, @Body() body: IssueDto) {
    return this.drivers.issue(user, id, body.kind, body.note);
  }

  @Post('assignments/:id/location')
  ping(@CurrentUser() user: User, @Param('id') id: string, @Body() body: PingDto) {
    return this.safety.ping(user, id, body);
  }
}
