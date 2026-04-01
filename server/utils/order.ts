export function generateOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

