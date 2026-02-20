import { Module } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { AgentController } from './agent.controller.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { SandboxModule } from '../sandbox/sandbox.module.js';
import { GithubModule } from '../github/github.module.js';
import { McpModule } from '../mcp/mcp.module.js';
import { VercelModule } from '../vercel/vercel.module.js';
import { AuthModule } from '../auth/auth.module.js';

/** AgentModule — wires the pipeline orchestrator with all required foundation service modules. */
@Module({
    imports: [JobsModule, SandboxModule, GithubModule, McpModule, VercelModule, AuthModule],
    controllers: [AgentController],
    providers: [AgentService],
})
export class AgentModule { }
