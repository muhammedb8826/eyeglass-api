import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthDto } from './dto';
import * as bcrypt from 'bcrypt';
import { Tokens } from './types';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService
    ) {}

    async signupLocal(dto: AuthDto): Promise<{ tokens: Tokens, user: any }> {
        try {
            const { email, password, phone, address } = dto;
            const hashedPassword = await this.hashPassword(password);
            
            const newUser = this.userRepository.create({
                email,
                password: hashedPassword,
                confirm_password: hashedPassword,
                phone,
                address,
            });
            
            const savedUser = await this.userRepository.save(newUser);
            const tokens = await this.getTokens(savedUser.id, savedUser.email);
            await this.updateRtHash(savedUser.id, tokens.refreshToken);
            return { tokens, user: savedUser };
        } catch (error) {
            throw new ForbiddenException('Error creating user: ' + error.message);
        }
    }

    async signinLocal(dto: AuthDto): Promise<{ tokens: Tokens, user: any }> {
        const email = dto.email.toLowerCase();
        const user = await this.userRepository.findOne({
            where: {
                email: email,
            }
        });

        // If no user is found, throw an error
        if (!user) {
            throw new NotFoundException(`No user found for email: ${email}`);
        }

        const passwordMatches = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatches) throw new ForbiddenException('Check password');
        
        const tokens = await this.getTokens(user.id, user.email);
        await this.updateRtHash(user.id, tokens.refreshToken);
        return { tokens, user };
    }

    async logout(userId: string) {
        await this.userRepository
            .createQueryBuilder()
            .update(User)
            .set({ passwordRT: null })
            .where('id = :userId', { userId })
            .andWhere('passwordRT IS NOT NULL')
            .execute();
    }

    async refreshTokens(userId: string, rt: string) {
        const user = await this.userRepository.findOne({
            where: {
                id: userId
            },
        });
        
        if (!user || !user.passwordRT) throw new ForbiddenException('Access Denied');
        
        const rtMatches = await bcrypt.compare(rt, user.passwordRT);
        if (!rtMatches) throw new ForbiddenException('Access Denied');

        const tokens = await this.getTokens(user.id, user.email);
        await this.updateRtHash(user.id, tokens.refreshToken);
        return { tokens, user };
    }

    async hashPassword(password: string) {
        return await bcrypt.hash(password, 10);
    }

    async getTokens(userId: string, email: string): Promise<Tokens> {
        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(
                {
                    sub: userId,
                    email,
                },
                {
                    secret: 'at-secret',
                    expiresIn: 60 * 60 * 24,
                }
            ),
            this.jwtService.signAsync(
                {
                    sub: userId,
                    email,
                },
                {
                    secret: 'rt-secret',
                    expiresIn: 60 * 60 * 24 * 3,
                }
            )
        ]);

        return {
            accessToken: at,
            refreshToken: rt
        };
    }

    async updateRtHash(userId: string, rt: string) {
        const hash = await this.hashPassword(rt);
        await this.userRepository.update(
            {
                id: userId,
            },
            {
                passwordRT: hash
            }
        );
    }
}
