import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Testimonial } from './entities/testimonial.entity';

export interface TestimonialDto {
  name: string;
  role?: string;
  content: string;
  rating?: number;
  userId?: string;
}

@Injectable()
export class AdminTestimonialsService {
  constructor(
    @InjectRepository(Testimonial)
    private testimonialRepo: Repository<Testimonial>,
  ) {}

  listTestimonials() {
    return this.testimonialRepo.find({
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async createTestimonial(dto: TestimonialDto) {
    const maxOrder = await this.testimonialRepo
      .createQueryBuilder('t')
      .select('MAX(t.displayOrder)', 'max')
      .getRawOne<{ max: number | null }>();

    const testimonial = this.testimonialRepo.create({
      ...dto,
      rating: dto.rating ?? 5,
      displayOrder: (maxOrder?.max ?? -1) + 1,
    });
    return this.testimonialRepo.save(testimonial);
  }

  async updateTestimonial(id: string, dto: Partial<TestimonialDto>) {
    const t = await this.testimonialRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Testimonial not found');
    Object.assign(t, dto);
    return this.testimonialRepo.save(t);
  }

  async deleteTestimonial(id: string) {
    const t = await this.testimonialRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Testimonial not found');
    await this.testimonialRepo.remove(t);
    return { message: 'Deleted' };
  }

  async togglePublish(id: string) {
    const t = await this.testimonialRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Testimonial not found');
    t.isPublished = !t.isPublished;
    return this.testimonialRepo.save(t);
  }

  async reorder(orderedIds: string[]) {
    const testimonials = await this.testimonialRepo.find({
      where: { id: In(orderedIds) },
    });

    const updates = orderedIds.map((id, index) => {
      const t = testimonials.find((t) => t.id === id);
      if (t) t.displayOrder = index;
      return t;
    });

    await this.testimonialRepo.save(updates.filter(Boolean) as Testimonial[]);
    return { message: 'Reordered' };
  }
}
