import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OrderService } from '../src/order-service.js';

const sign = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('payment webhook to print queue', () => {
  it('enqueues exactly one print job for replayed webhook events', () => {
    const secret = 'webhook-secret';
    const service = new OrderService(secret);

    service.addPrinter({ id: 'p1', isEnabled: true, isOnline: true, hasPaper: true });
    service.createOrder({
      id: 'o1',
      shopId: 's1',
      printerId: 'p1',
      files: [{ selectedPagesAfterEdit: 10, copies: 1 }],
      maxPagesPerOrder: 100,
      totalAmount: 500,
      currency: 'INR',
    });

    const payment = service.createPayment('o1');

    const event = {
      id: 'evt_1',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            order_id: payment.gatewayOrderId,
            amount: 500,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            notes: { order_id: 'o1' },
          },
        },
      },
    };

    const body = JSON.stringify(event);
    const signature = sign(body, secret);

    const first = service.processWebhook(body, signature);
    const replay = service.processWebhook(body, signature);

    expect(first.enqueued).toBe(true);
    expect(replay.deduped).toBe(true);
    expect(service.getPrintJobs()).toHaveLength(1);
    expect(service.getOrder('o1')?.status).toBe('QUEUED');
  });

  it('does not create payment for unavailable printer', () => {
    const service = new OrderService('secret');
    service.addPrinter({ id: 'p2', isEnabled: true, isOnline: false, hasPaper: true });
    service.createOrder({
      id: 'o2',
      shopId: 's1',
      printerId: 'p2',
      files: [{ selectedPagesAfterEdit: 2, copies: 1 }],
      maxPagesPerOrder: 100,
      totalAmount: 100,
      currency: 'INR',
    });

    expect(() => service.createPayment('o2')).toThrow(
      'No available printer. Select an online printer with paper before payment.',
    );
  });
});
