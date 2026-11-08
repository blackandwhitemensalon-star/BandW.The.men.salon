export const customerRoom = customerId => `customer:${customerId}`;

export const customerAppointmentUpdate = appointment => ({
  appointmentId: String(appointment._id),
  status: appointment.status,
  updatedAt: appointment.updatedAt,
});
