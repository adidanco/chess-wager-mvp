import { logger } from "./logger"

class NetworkHandler {
  constructor() {
    this.maxRetries = 3
    this.retryDelay = 1000 // 1 second
    this.isOnline = navigator.onLine
    this.setupNetworkListeners()
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      logger.info('NetworkHandler', 'Network connection restored')
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      logger.warn('NetworkHandler', 'Network connection lost')
    })
  }

  async executeOperation(operation, retryCount = 0) {
    if (!this.isOnline) {
      throw new Error('No network connection')
    }

    try {
      return await operation()
    } catch (error) {
      if (retryCount < this.maxRetries) {
        logger.warn('NetworkHandler', 'Operation failed, retrying', {
          error,
          retryCount,
          maxRetries: this.maxRetries
        })
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        return this.executeOperation(operation, retryCount + 1)
      }
      
      logger.error('NetworkHandler', 'Operation failed after max retries', {
        error,
        retryCount
      })
      throw error
    }
  }

  async executeBatchOperation(operations) {
    if (!this.isOnline) {
      throw new Error('No network connection')
    }

    const results = []
    for (const operation of operations) {
      try {
        const result = await this.executeOperation(operation)
        results.push({ success: true, result })
      } catch (error) {
        results.push({ success: false, error })
      }
    }

    return results
  }

  isConnected() {
    return this.isOnline
  }
}

export const networkHandler = new NetworkHandler() 