import { Product } from './types';

export const DEFAULT_WHOLESALE_MIN_QTY = 5;

/**
 * Retorna o preço unitário correto para a quantidade informada: se o
 * produto tem atacado habilitado e a quantidade atinge o mínimo
 * configurado, aplica o valor de atacado (fixo ou percentual sobre o
 * preço de varejo); caso contrário, retorna o preço normal.
 */
export function getUnitPrice(product: Product, quantity: number): number {
  if (
    product.wholesaleEnabled &&
    product.wholesaleValue != null &&
    quantity >= (product.wholesaleMinQty ?? DEFAULT_WHOLESALE_MIN_QTY)
  ) {
    if (product.wholesaleMode === 'PERCENTAGE') {
      const discount = Math.min(Math.max(product.wholesaleValue, 0), 100);
      return Math.max(0, product.price * (1 - discount / 100));
    }
    // 'VALUE' (ou modo não definido, mas wholesaleValue presente): preço fixo por unidade.
    return Math.max(0, product.wholesaleValue);
  }
  return product.price;
}

export function isWholesaleActive(product: Product, quantity: number): boolean {
  return (
    !!product.wholesaleEnabled &&
    product.wholesaleValue != null &&
    quantity >= (product.wholesaleMinQty ?? DEFAULT_WHOLESALE_MIN_QTY)
  );
}
