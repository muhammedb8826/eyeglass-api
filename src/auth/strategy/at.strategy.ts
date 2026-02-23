import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

type JwtPayload = {
    sub: string,
    email: string
}

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: 'at-secret',
            ignoreExpiration: false
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.userRepository.findOne({
            where: {
                id: payload.sub
            }
        });
        
        if (!user) {
            throw new UnauthorizedException();
        }
        
        delete user.password;
        return user;
    }
}