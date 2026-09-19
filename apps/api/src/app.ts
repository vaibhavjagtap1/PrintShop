import express from 'express';
import { OrderService } from './order-service.js';

export const createApp = (service: OrderService) => {
  const app = express();
  app.use(express.json());

  app.post('/api/orders/:id/payment/create', (req, res) => {
    try {
      const payment = service.createPayment(req.params.id);
      return res.status(200).json({
        payment_session_id: payment.gatewayOrderId,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency,
      });
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/payments/webhook', express.text({ type: '*/*' }), (req, res) => {
    try {
      const signature = req.header('x-razorpay-signature');
      if (!signature) {
        return res.status(400).json({ error: 'Missing signature' });
      }
      const result = service.processWebhook(req.body, signature);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  });

  return app;
};
