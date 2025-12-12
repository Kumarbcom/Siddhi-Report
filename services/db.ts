
import { SalesReportItem } from '../types';

const DB_NAME = 'MaterialMasterAI_DB';
const DB_VERSION = 1;
const STORE_SALES = 'sales_report';

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        // Create store with 'id' as keyPath
        db.createObjectStore(STORE_SALES, { keyPath: 'id' });
      }
    };
  });
};

export const dbService = {
  // Load all items (FAST)
  async getAllSales(): Promise<SalesReportItem[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_SALES, 'readonly');
        const store = transaction.objectStore(STORE_SALES);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("DB Load Error:", error);
      return [];
    }
  },

  // Bulk add items (Transaction safe)
  async addSalesBatch(items: SalesReportItem[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SALES, 'readwrite');
      const store = transaction.objectStore(STORE_SALES);

      items.forEach(item => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  // Update single item
  async updateSale(item: SalesReportItem): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SALES, 'readwrite');
      const store = transaction.objectStore(STORE_SALES);
      store.put(item); // put updates if key exists
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  // Delete single item
  async deleteSale(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SALES, 'readwrite');
      const store = transaction.objectStore(STORE_SALES);
      store.delete(id);
      transaction.oncomplete = () => resolve();
    });
  },

  // Clear all data
  async clearAllSales(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SALES, 'readwrite');
      const store = transaction.objectStore(STORE_SALES);
      store.clear();
      transaction.oncomplete = () => resolve();
    });
  }
};
