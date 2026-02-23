import { Public } from './../decorators/public.decorator';
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto';
import { Tokens } from './types';
import { AtGuard, RtGuard } from 'src/common';
import { GetCurrentUser, GetCurrentUserId } from 'src/decorators';

@Controller()
export class AuthController {
    constructor(private authService: AuthService) {}
    
    @Public()
    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    async signupLocal(@Body() dto: AuthDto): Promise<{ tokens: Tokens, user: any }>{
        return this.authService.signupLocal(dto);
    }

    @Public()
    @Post('signin')
    @HttpCode(HttpStatus.OK)
    async signinLocal(@Body() dto: AuthDto): Promise<{ tokens: Tokens, user: any }>{
        return this.authService.signinLocal(dto);
    }

    @UseGuards(AtGuard)
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@GetCurrentUserId() userId: string){
     return this.authService.logout(userId);
    }  

    @Public()
    @UseGuards(RtGuard)
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshTokens(@GetCurrentUserId() userId: string, @GetCurrentUser('refreshToken') refreshToken: string){
        return this.authService.refreshTokens(userId,refreshToken);
    }
}
