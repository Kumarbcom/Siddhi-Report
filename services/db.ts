
import { SalesReportItem } from '../types';

const DB_NAME = 'MaterialMasterAI_DB_V2'; // Versioned name for fresh start
const DB_VERSION = 2; // Incremented version
const STORE_SALES = 'sales_report';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        db.createObjectStore(STORE_SALES, { keyPath: 'id' });
      }
    };
  });
};

export const dbService = {
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
      console.error("IndexedDB Load Error:", error);
      return [];
    }
  },

  async addSalesBatch(items: SalesReportItem[]): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_SALES, 'readwrite');
        const store = transaction.objectStore(STORE_SALES);
        items.forEach(item => {
          if (item && item.id) store.put(item);
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error("IndexedDB Put Error:", e);
    }
  },

  async updateSale(item: SalesReportItem): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_SALES, 'readwrite');
        const store = transaction.objectStore(STORE_SALES);
        store.put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error("IndexedDB Update Error:", e);
    }
  },

  async deleteSale(id: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_SALES, 'readwrite');
        const store = transaction.objectStore(STORE_SALES);
        store.delete(id);
        transaction.oncomplete = () => resolve();
      });
    } catch (e) {
      console.error("IndexedDB Delete Error:", e);
    }
  },

  async clearAllSales(): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_SALES, 'readwrite');
        const store = transaction.objectStore(STORE_SALES);
        store.clear();
        transaction.oncomplete = () => resolve();
      });
    } catch (e) {
      console.error("IndexedDB Clear Error:", e);
    }
  }
};
