import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { Testimonial } from './entities/testimonial.entity';

@Controller('testimonials')
export class PublicTestimonialsController {
  constructor(
    @InjectRepository(Testimonial)
    private readonly testimonialRepo: Repository<Testimonial>,
  ) {}

  @Public()
  @Get()
  async getPublishedTestimonials() {
    return this.testimonialRepo.find({
      where: { isPublished: true },
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
      select: [
        'id',
        'name',
        'role',
        'content',
        'rating',
        'displayOrder',
        'createdAt',
      ],
    });
  }
}
