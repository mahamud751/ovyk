import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useStaticAssets(join(process.cwd(), 'public'));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('OVYK API')
    .setDescription(
      'Premium private transport for a stay in Bangladesh. Local build: OTP debug code is 123456. Customer Ahad +8801711111111. Driver driver@ovyk.com / driver123. Admin admin@ovyk.com / admin123 then the same OTP. Card numbers are never accepted or stored. Payments are simulated provider tokens.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`OVYK API http://localhost:${port}/api/health`);
  console.log(`Swagger http://localhost:${port}/docs`);
  console.log(`Operations http://localhost:${port}/ops.html`);
  console.log(`Nominee tracking http://localhost:${port}/track.html`);
}

bootstrap();
