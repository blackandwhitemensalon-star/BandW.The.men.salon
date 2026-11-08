import assert from "node:assert/strict";
import test from "node:test";
import { customerAppointmentUpdate, customerRoom } from "../appointmentSync.js";

test("customer appointment events target a user-specific room", () => {
  assert.equal(customerRoom("customer-123"), "customer:customer-123");
  assert.notEqual(customerRoom("customer-123"), customerRoom("customer-456"));
});

test("customer status events contain no private appointment or customer details", () => {
  const updatedAt = new Date("2026-11-08T10:00:00.000Z");
  const payload = customerAppointmentUpdate({
    _id: "appointment-123",
    userId: "customer-123",
    name: "Private Customer Name",
    phone: "private phone",
    message: "private booking note",
    status: "confirmed",
    updatedAt,
  });

  assert.deepEqual(payload, {
    appointmentId: "appointment-123",
    status: "confirmed",
    updatedAt,
  });
});
