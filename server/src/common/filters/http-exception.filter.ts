import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Global exception filter — converts any thrown exception into a structured JSON error response. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';

        this.logger.error(
            `${req.method} ${req.url} → ${status}`,
            exception instanceof Error ? exception.stack : String(exception),
        );

        res.status(status).json({
            statusCode: status,
            message: typeof message === 'object' ? (message as Record<string, unknown>).message ?? message : message,
            timestamp: new Date().toISOString(),
            path: req.url,
        });
    }
}
