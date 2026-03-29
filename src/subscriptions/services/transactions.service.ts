import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities';
import { LoggerService } from '../../logger/logger.service';
import {
  PaymentStatus,
  PaymentProvider,
  Currency,
  TransactionType,
  LogActionTypes,
} from '../../../types';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    private loggerService: LoggerService,
  ) {}

  /**
   * Create a new transaction record
   */
  async create(data: {
    studentId: string;
    studentExamTypeId?: string;
    subscriptionId?: string;
    sponsorId?: string;
    type: TransactionType;
    amount: number;
    currency: Currency;
    region?: string;
    provider: PaymentProvider;
    providerTransactionId?: string;
    providerCustomerId?: string;
  }): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      ...data,
      status: PaymentStatus.PENDING,
    });

    return this.transactionRepo.save(transaction);
  }

  /**
   * Update provider customer ID on a transaction
   */
  async updateCustomerId(
    transactionId: string,
    providerCustomerId: string,
  ): Promise<void> {
    await this.transactionRepo.update(transactionId, { providerCustomerId });
  }

  /**
   * Find transaction by provider transaction ID
   */
  async findByProviderTransactionId(
    providerTransactionId: string,
  ): Promise<Transaction | null> {
    return this.transactionRepo.findOne({
      where: { providerTransactionId },
      relations: ['subscription', 'student'],
    });
  }

  /**
   * Find most recent transaction by provider customer ID
   */
  async findByProviderCustomerId(
    providerCustomerId: string,
  ): Promise<Transaction | null> {
    return this.transactionRepo.findOne({
      where: { providerCustomerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    transactionId: string,
    status: PaymentStatus,
    providerResponse?: Record<string, any>,
    failureReason?: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = status;
    if (providerResponse) {
      transaction.providerResponse = providerResponse;
    }
    if (failureReason) {
      transaction.failureReason = failureReason;
    }
    if (status === PaymentStatus.SUCCEEDED) {
      transaction.paidAt = new Date();
    }

    await this.transactionRepo.save(transaction);

    // Log status update
    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: `Transaction ${status}`,
      metadata: {
        transactionId: transaction.id,
        status,
        providerTransactionId: transaction.providerTransactionId,
      },
    });

    return transaction;
  }

  /**
   * Find transactions by student
   */
  async findByStudent(
    studentId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Transaction[]> {
    return this.transactionRepo.find({
      where: { studentId },
      relations: ['subscription'],
      order: { createdAt: 'DESC' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  /**
   * Find transactions by subscription
   */
  async findBySubscription(subscriptionId: string): Promise<Transaction[]> {
    return this.transactionRepo.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<Transaction | null> {
    return this.transactionRepo.findOne({
      where: { id },
      relations: ['subscription', 'student', 'studentExamType'],
    });
  }
}
