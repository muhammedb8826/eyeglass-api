import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('file')
export class FileController {
    @Post('upload')
    @UseInterceptors(FileInterceptor('file', { // 'file' should match the name attribute in the form
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                return cb(new BadRequestException('Only image files are allowed!'), false);
            }
            cb(null, true);
        },
    }))
    uploadFile(@UploadedFile() file: any, @Body() body) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        console.log(file); // Do something with the uploaded file
        console.log(body); // Handle other form fields
        return {
            originalname: file.originalname,
            filename: file.filename,
            path: file.path,
        };
    }
}
