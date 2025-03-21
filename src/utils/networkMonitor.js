import { logger } from './logger'

class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine
    this.setupListeners()
  }

  setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      logger.info('NetworkMonitor', 'Network connection restored')
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      logger.warn('NetworkMonitor', 'Network connection lost')
    })
  }

  checkConnection() {
    if (!this.isOnline) {
      logger.warn('NetworkMonitor', 'No network connection')
      return false
    }
    return true
  }
}

export const networkMonitor = new NetworkMonitor() 