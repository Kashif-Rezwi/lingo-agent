import { Controller, Post, Get, Param, Body, Sse, Logger, NotFoundException, UseGuards } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

import { AgentService } from './agent.service.js';
import { StartJobDto } from './dto/start-job.dto.js';
import { JobResponseDto } from './dto/job-response.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';

/** Exposes the agent pipeline via REST + SSE endpoints. */
@Controller('agent')
export class AgentController {
    private readonly logger = new Logger(AgentController.name);

    constructor(private readonly agent: AgentService) { }

    /** Starts pipeline async and returns jobId. Client uses SSE for live events. */
    @UseGuards(AuthGuard)
    @Post('run')
    async run(@Body() dto: StartJobDto): Promise<JobResponseDto> {
        const jobId = await this.agent.startJob(dto.repoUrl, dto.locales, dto.githubToken, dto.lingoApiKey, dto.groqApiKey);
        this.logger.log(`Job started: ${jobId}`);
        return { jobId };
    }

    /** SSE stream for real-time job progress. Emits log, progress, complete, and error events. */
    @Sse('stream/:jobId')
    stream(@Param('jobId') jobId: string): Observable<MessageEvent> {
        try {
            return this.agent.getStream(jobId).pipe(
                map((event) => ({
                    // Serialize data as JSON for NestJS SSE
                    data: event,
                })),
            );
        } catch {
            throw new NotFoundException(`No active stream for job ${jobId}`);
        }
    }

    /** Manually aborts a running job */
    @UseGuards(AuthGuard)
    @Post('cancel/:jobId')
    async cancel(@Param('jobId') jobId: string) {
        await this.agent.cancelJob(jobId);
        return { message: 'Job cancelled' };
    }

    /** Get job state */
    @UseGuards(AuthGuard)
    @Get('job/:jobId')
    async getJob(@Param('jobId') jobId: string) {
        return this.agent.getJob(jobId);
    }
}
