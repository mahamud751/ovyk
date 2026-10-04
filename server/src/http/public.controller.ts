import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Public } from '../common/auth';
import { SafetyService } from '../domain/safety.service';

class ShareNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags('public')
@Controller()
export class PublicController {
  constructor(private readonly safety: SafetyService) {}

  @Public()
  @Get('health')
  health() {
    return { ok: true, service: 'ovyk' };
  }

  @Public()
  @Get('share/:token')
  share(@Param('token') token: string) {
    return this.safety.openShare(token);
  }

  @Public()
  @Post('share/:token/check')
  check(@Param('token') token: string, @Body() body: ShareNoteDto) {
    return this.safety.shareAction(token, 'check', body.note);
  }

  @Public()
  @Post('share/:token/concern')
  concern(@Param('token') token: string, @Body() body: ShareNoteDto) {
    return this.safety.shareAction(token, 'concern', body.note);
  }

  @Public()
  @Get('share/:token/missing')
  missing() {
    throw new NotFoundException('Use /share/:token');
  }
}
