import { Injectable, NotFoundException } from '@nestjs/common';
import { Job, JobStatus } from '@prisma/client';
import { PrismaService } from './prisma.service.js';

/** Handles persistent job state, tracking the lifecycle of agent pipeline runs. */
@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) { }

  create(repoUrl: string, locales: string[]): Promise<Job> {
    return this.prisma.job.create({
      data: { repoUrl, locales, status: 'pending' },
    });
  }

  async findOneOrThrow(id: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  updateStatus(id: string, status: JobStatus): Promise<Job> {
    return this.prisma.job.update({ where: { id }, data: { status } });
  }

  setResult(id: string, prUrl: string, previewUrl: string): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: { status: 'completed', prUrl, previewUrl },
    });
  }

  setError(id: string, error: string): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: { status: 'failed', error },
    });
  }
}
