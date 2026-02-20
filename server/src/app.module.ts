import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { JobsModule } from './jobs/jobs.module.js';
import { SandboxModule } from './sandbox/sandbox.module.js';
import { GithubModule } from './github/github.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { VercelModule } from './vercel/vercel.module.js';

@Module({
  imports: [
    // Makes env variables available everywhere without re-importing ConfigModule
    ConfigModule.forRoot({ isGlobal: true }),

    // Foundation service modules — each independently testable and exported
    JobsModule,
    SandboxModule,
    GithubModule,
    McpModule,
    VercelModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
