import { Injectable } from '@nestjs/common';

/** Validates that an incoming token is a non-empty string. Extensible for future signature checks. */
@Injectable()
export class AuthService {
    validateToken(token: string): boolean {
        return typeof token === 'string' && token.trim().length > 0;
    }
}
