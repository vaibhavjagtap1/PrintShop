import crypto from 'node:crypto';
import { evaluatePageLimit, type FilePageSelection } from '@printshop/shared/src/index.js';

export type OrderStatus =
  | 'DRAFT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'QUEUED'
  | 'PRINT_FAILED'
  | 'PAYMENT_MISMATCH';

export type PrinterState = {
  id: string;
  isEnabled: boolean;
  isOnline: boolean;
  hasPaper: boolean;
};

export type Order = {
  id: string;
  shopId: string;
  printerId: string;
  files: FilePageSelection[];
  maxPagesPerOrder: number;
  status: OrderStatus;
  totalAmount: number;
  currency: 'INR';
};

export type PaymentAttempt = {
  gatewayOrderId: string;
  orderId: string;
  amount: number;
  currency: 'INR';
  method: 'upi';
  attemptNo: number;
};

type WebhookPayload = {
  id: string;
  event: 'payment.captured' | 'order.paid';
  payload: {
    payment: {
      entity: {
        order_id: string;
        amount: number;
        currency: 'INR';
        status: 'captured' | string;
        method: string;
        notes?: { order_id?: string };
      };
    };
  };
};

export class OrderService {
  private orders = new Map<string, Order>();
  private printers = new Map<string, PrinterState>();
  private attempts = new Map<string, PaymentAttempt[]>();
  private dedupeEvents = new Set<string>();
  private printJobs = new Map<string, { orderId: string; printerId: string }>();

  constructor(private readonly webhookSecret: string) {}

  addPrinter(printer: PrinterState) {
    this.printers.set(printer.id, printer);
  }

  createOrder(order: Omit<Order, 'status'>) {
    const created: Order = { ...order, status: 'DRAFT' };
    this.orders.set(created.id, created);
    return created;
  }

  createPayment(orderId: string): PaymentAttempt {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const printer = this.printers.get(order.printerId);
    if (!printer || !printer.isEnabled || !printer.isOnline || !printer.hasPaper) {
      throw new Error('No available printer. Select an online printer with paper before payment.');
    }

    const pageUsage = evaluatePageLimit(order.files, order.maxPagesPerOrder);
    if (pageUsage.blocked) {
      throw new Error(pageUsage.message);
    }

    const previousAttempts = this.attempts.get(order.id) ?? [];
    const payment: PaymentAttempt = {
      gatewayOrderId: crypto.randomUUID(),
      orderId: order.id,
      amount: order.totalAmount,
      currency: order.currency,
      method: 'upi',
      attemptNo: previousAttempts.length + 1,
    };

    this.attempts.set(order.id, [...previousAttempts, payment]);
    order.status = 'AWAITING_PAYMENT';

    return payment;
  }

  verifyWebhookSignature(rawBody: string, signature: string) {
    const digest = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const a = Buffer.from(digest, 'utf-8');
    const b = Buffer.from(signature, 'utf-8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  processWebhook(rawBody: string, signature: string) {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody) as WebhookPayload;

    if (this.dedupeEvents.has(event.id)) {
      return { deduped: true, enqueued: false };
    }

    this.dedupeEvents.add(event.id);

    const payment = event.payload.payment.entity;
    const order = this.orders.get(payment.notes?.order_id ?? '');
    if (!order) {
      throw new Error('Order not found for webhook');
    }

    const latestAttempt = (this.attempts.get(order.id) ?? []).at(-1);
    const isMismatch =
      !latestAttempt ||
      latestAttempt.gatewayOrderId !== payment.order_id ||
      latestAttempt.amount !== payment.amount ||
      latestAttempt.currency !== payment.currency ||
      payment.status !== 'captured' ||
      payment.method !== 'upi';

    if (isMismatch) {
      order.status = 'PAYMENT_MISMATCH';
      return { deduped: false, enqueued: false, mismatch: true };
    }

    order.status = 'PAID';

    const printer = this.printers.get(order.printerId);
    if (!printer || !printer.isEnabled || !printer.isOnline || !printer.hasPaper) {
      return { deduped: false, enqueued: false, paidButPrinterUnavailable: true };
    }

    if (!this.printJobs.has(order.id)) {
      this.printJobs.set(order.id, { orderId: order.id, printerId: order.printerId });
      order.status = 'QUEUED';
      return { deduped: false, enqueued: true };
    }

    return { deduped: false, enqueued: false };
  }

  getPrintJobs() {
    return [...this.printJobs.values()];
  }

  getOrder(orderId: string) {
    return this.orders.get(orderId);
  }
}
