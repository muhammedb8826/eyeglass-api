import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt,  Strategy } from 'passport-jwt';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: 'rt-secret',
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: any) {
        const authHeader = req.get('Authorization');
        if (!authHeader) {
            console.log('No Authorization header');
            throw new UnauthorizedException('Refresh token missing');
        }
        
        const refreshToken = authHeader.replace('Bearer', '').trim();
    if (!refreshToken) {
        console.log('Refresh token missing from header');
        throw new UnauthorizedException('Refresh token missing');
    }
        
    console.log('Validating refresh token:', refreshToken);
    return { ...payload, refreshToken };
    }
}