import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3004;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: port,
    },
  });

  await app.listen();
  console.log(`User Microservice is running on port: ${port}`);
}
bootstrap();