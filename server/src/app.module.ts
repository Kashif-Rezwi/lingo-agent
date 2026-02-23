import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { JobsModule } from './jobs/jobs.module.js';
import { SandboxModule } from './sandbox/sandbox.module.js';
import { GithubModule } from './github/github.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { VercelModule } from './vercel/vercel.module.js';
import { AgentModule } from './agent/agent.module.js';

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

    // Agent module — orchestrates the 7-tool pipeline via generateText
    AgentModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule { }
