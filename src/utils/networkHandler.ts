import { logger } from "./logger";

type OperationFunction<T> = () => Promise<T>;

interface BatchOperationResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
}

class NetworkHandler {
  private maxRetries: number;
  private retryDelay: number;
  private isOnline: boolean;

  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.isOnline = navigator.onLine;
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.info('NetworkHandler', 'Network connection restored');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.warn('NetworkHandler', 'Network connection lost');
    });
  }

  async executeOperation<T>(operation: OperationFunction<T>, retryCount = 0): Promise<T> {
    if (!this.isOnline) {
      throw new Error('No network connection');
    }

    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.maxRetries) {
        logger.warn('NetworkHandler', 'Operation failed, retrying', {
          error,
          retryCount,
          maxRetries: this.maxRetries
        });
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.executeOperation(operation, retryCount + 1);
      }
      
      logger.error('NetworkHandler', 'Operation failed after max retries', {
        error,
        retryCount
      });
      throw error;
    }
  }

  async executeBatchOperation<T>(operations: OperationFunction<T>[]): Promise<BatchOperationResult<T>[]> {
    if (!this.isOnline) {
      throw new Error('No network connection');
    }

    const results: BatchOperationResult<T>[] = [];
    for (const operation of operations) {
      try {
        const result = await this.executeOperation(operation);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error as Error });
      }
    }

    return results;
  }

  isConnected(): boolean {
    return this.isOnline;
  }
}

export const networkHandler = new NetworkHandler(); 