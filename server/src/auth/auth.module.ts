import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';

/** Provides AuthGuard and AuthService for use in feature modules that need route protection. */
@Module({
    providers: [AuthService, AuthGuard],
    exports: [AuthService, AuthGuard],
})
export class AuthModule { }
