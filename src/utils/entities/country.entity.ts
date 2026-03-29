import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities';

@Entity('countries')
export class Country extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column()
  code: string; // Phone code (e.g., '+234')

  @Column()
  codeLabel: string; // With flag emoji (e.g., '🇳🇬 +234')

  @Column({ unique: true })
  isoCode: string; // ISO country code (e.g., 'NG')

  @Column({ default: true })
  isActive: boolean;
}
