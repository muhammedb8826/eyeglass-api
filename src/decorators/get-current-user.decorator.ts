import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetCurrentUser = createParamDecorator(
    (data: string | undefined, context: ExecutionContext): string => {
        const request = context.switchToHttp().getRequest();
        if(!data) return request.user;
        return request.user[data]
    }
)