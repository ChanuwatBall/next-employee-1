import React from 'react';
import { render } from '@testing-library/react';
import App from './App';
import { canSellOnboardTickets } from './pages/PlanChair';
import {
  resolvePassengerTypePrice,
  resolvePaymentTotal,
} from './pages/SellTicket';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});

test('only allows onboard ticket sales when trip flag is enabled', () => {
  expect(canSellOnboardTickets({ onboard_ticket_sales_enabled: true })).toBe(true);
  expect(canSellOnboardTickets({ onboard_ticket_sales_enabled: false })).toBe(false);
  expect(canSellOnboardTickets(null)).toBe(false);
  expect(canSellOnboardTickets(undefined)).toBe(false);
});

test('uses the selected passenger type price instead of the base trip price', () => {
  expect(
    resolvePassengerTypePrice({
      passengerType: 'child',
      passengerTypeOptions: [
        { code: 'general', name: 'ทั่วไป', price: 120 },
        { code: 'child', name: 'เด็ก', price: 490 },
      ],
      seatPrice: 150,
      tripPrice: 200,
    }),
  ).toBe(490);

  expect(
    resolvePassengerTypePrice({
      passengerType: 'senior',
      passengerTypeOptions: [
        { code: 'general', name: 'ทั่วไป', price: 120 },
      ],
      seatPrice: 150,
      tripPrice: 200,
    }),
  ).toBe(150);
});

test('falls back to the sale total when the QR payment response has no total field', () => {
  expect(
    resolvePaymentTotal({
      paymentData: { status: 'pending', qrCodeUrl: 'test-qr' },
      fallbackTotal: 1200,
    }),
  ).toBe(1200);

  expect(
    resolvePaymentTotal({
      paymentData: { total: 2450, status: 'pending' },
      fallbackTotal: 1200,
    }),
  ).toBe(2450);
});
