import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Language, User } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Public } from '../common/auth';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user';

class OtpRequestDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}

class OtpVerifyDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @IsString()
  @MinLength(4)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class MfaDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  code!: string;
}

class UpdateMeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(Language) preferredLanguage?: Language;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
  @IsOptional() @IsString() safeContactMethod?: string;
  @IsOptional() @IsString() emergencyName?: string;
  @IsOptional() @IsString() emergencyPhone?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() notifications?: { push?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean };
}

class EmailChangeDto {
  @IsEmail() email!: string;
  @IsString() code!: string;
}

class DeleteDto {
  @IsString() code!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('otp/request')
  request(@Body() body: OtpRequestDto) {
    return this.auth.requestOtp(body.phone, body.purpose || 'login');
  }

  @Public()
  @Post('otp/verify')
  verify(@Body() body: OtpVerifyDto) {
    return this.auth.verifyOtp(body.phone, body.code, body.name, body.language);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post('mfa')
  mfa(@Body() body: MfaDto) {
    return this.auth.confirmMfa(body.mfaToken, body.code);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Patch('me')
  update(@CurrentUser() user: User, @Body() body: UpdateMeDto) {
    return this.auth.updateMe(user, body);
  }

  @ApiBearerAuth()
  @Post('email')
  email(@CurrentUser() user: User, @Body() body: EmailChangeDto) {
    return this.auth.changeEmail(user, body.email, body.code);
  }

  @ApiBearerAuth()
  @Delete('account')
  remove(@CurrentUser() user: User, @Body() body: DeleteDto) {
    return this.auth.deleteAccount(user, body.code);
  }
}
