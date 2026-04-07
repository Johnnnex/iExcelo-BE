import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { UserType } from '../../types';
import {
  ALLOWED_IMAGE_MIMETYPES,
  MAX_IMAGE_UPLOAD_SIZE,
} from '../common/constants';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN, UserType.SPONSOR, UserType.STUDENT)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload an image to Cloudinary.
   * Returns a CDN URL for inline markdown insertion: ![alt](url)
   * Accessible by ADMIN, SPONSOR, and STUDENT roles.
   *
   * @param folder  Cloudinary sub-folder under iexcelo/ (e.g. "questions", "chat"). Defaults to "questions".
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
          cb(
            new Error(
              `Unsupported file type. Allowed: ${ALLOWED_IMAGE_MIMETYPES.join(', ')}`,
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'questions',
  ) {
    const url = await this.uploadService.uploadImage(file, folder);
    return { message: 'Image uploaded successfully', data: { url } };
  }
}
