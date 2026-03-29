/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserType } from '../../types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create(createUserDto);
    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByIdWithProfile(id: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['studentProfile', 'sponsorProfile', 'affiliateProfile'],
    });

    if (!user) {
      return null;
    }

    // Return user with only the relevant profile based on role
    const profileMap = {
      [UserType.STUDENT]: user.studentProfile,
      [UserType.SPONSOR]: user.sponsorProfile,
      [UserType.AFFILIATE]: user.affiliateProfile,
    };

    // Clean up - remove other profiles
    return {
      ...user,
      profile: profileMap[user.role as UserType] || null,
      studentProfile: undefined,
      sponsorProfile: undefined,
      affiliateProfile: undefined,
    } as any;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    Object.assign(user, updateUserDto);
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userRepo.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.isActive = false;
    return this.userRepo.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.isActive = true;
    return this.userRepo.save(user);
  }
}
