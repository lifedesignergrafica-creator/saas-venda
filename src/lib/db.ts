import Dexie, { Table } from 'dexie';
import { User, Product, Sale } from './types';

export class AppDatabase extends Dexie {
  users!: Table<User, string>;
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;

  constructor() {
    super('saas_store_db');
    this.version(1).stores({
      users: 'id, email, role',
      products: 'id, name, stockQuantity',
      sales: 'id, attendantId, createdAt',
    });
  }
}

export const db = new AppDatabase();

/**
 * Serializes the entire local database into a plain JSON-friendly object,
 * matching the shape persisted as saas_store_db.json on Google Drive.
 */
export async function exportDbToJson() {
  const [users, products, sales] = await Promise.all([
    db.users.toArray(),
    db.products.toArray(),
    db.sales.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    users,
    products,
    sales,
  };
}

/**
 * Replaces a entire local database com dados carregados de um snapshot JSON
 * (typically downloaded from the Drive appDataFolder).
 */
export async function importDbFromJson(data: {
  users?: User[];
  products?: Product[];
  sales?: Sale[];
}) {
  await db.transaction('rw', db.users, db.products, db.sales, async () => {
    await db.users.clear();
    await db.products.clear();
    await db.sales.clear();
    if (data.users?.length) await db.users.bulkAdd(data.users);
    if (data.products?.length) await db.products.bulkAdd(data.products);
    if (data.sales?.length) await db.sales.bulkAdd(data.sales);
  });
}

export async function seedDefaultAdmin(email: string, name: string) {
  const existing = await db.users.where('email').equals(email).first();
  if (!existing) {
    await db.users.add({
      id: crypto.randomUUID(),
      name,
      email,
      role: 'ADMIN',
      createdAt: new Date(),
    });
  }
}
