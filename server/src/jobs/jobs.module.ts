import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { JobsService } from './jobs.service.js';

/** Exports PrismaService and JobsService for global database access. */
@Module({
  providers: [PrismaService, JobsService],
  exports: [PrismaService, JobsService],
})
export class JobsModule { }
