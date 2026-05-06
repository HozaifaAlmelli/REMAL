export const BOOKING_SOURCES = {
  website: 'website',
  direct: 'direct',
  whatsapp: 'whatsapp',
  phone: 'phone',
  admin: 'admin',
} as const

export type BookingSource = (typeof BOOKING_SOURCES)[keyof typeof BOOKING_SOURCES]

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  website: 'Website',
  direct: 'Direct',
  whatsapp: 'WhatsApp',
  phone: 'Phone Call',
  admin: 'Admin',
}
