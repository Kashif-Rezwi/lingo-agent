import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service.js';

/** Guards protected endpoints by requiring a Bearer token in the Authorization header. */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly auth: AuthService) { }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const authHeader = req.headers['authorization'];

        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or malformed Authorization header.');
        }

        const token = authHeader.slice(7); // strip "Bearer "
        if (!this.auth.validateToken(token)) {
            throw new UnauthorizedException('Invalid token.');
        }

        // Attach token to request so downstream can read it without re-parsing
        (req as Request & { githubToken: string }).githubToken = token;
        return true;
    }
}
