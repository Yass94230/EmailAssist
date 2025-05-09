import { TwilioResponse } from '../types';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private static logs: LogEntry[] = [];

  static log(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    this.logs.push(entry);
    console[level](message, data || '');

    if (level === 'error') {
      // Envoyer les logs au serveur en cas d'erreur
      this.sendLogsToServer(entry);
    }
  }

  private static async sendLogsToServer(entry: LogEntry) {
    try {
      await fetch('/.netlify/functions/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Échec de l\'envoi des logs au serveur:', error);
    }
  }

  static getLogs(): LogEntry[] {
    return this.logs;
  }
}

export default Logger;