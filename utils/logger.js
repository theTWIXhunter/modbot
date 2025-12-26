const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.resolve(__dirname, '..', 'data', 'logs');
    this.logFile = path.join(this.logDir, this._getLogFileName());
    this.stream = null;
    this._ensureLogDir();
    this._openStream();
    this._patchConsole();
  }

  _getLogFileName() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    return `modbot-${dateStr}.log`;
  }

  _ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _openStream() {
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  _patchConsole() {
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    const logger = this;
    console.log = function (...args) {
      logger.write('INFO', ...args);
      origLog.apply(console, args);
    };
    console.error = function (...args) {
      logger.write('ERROR', ...args);
      origError.apply(console, args);
    };
    console.warn = function (...args) {
      logger.write('WARN', ...args);
      origWarn.apply(console, args);
    };
  }

  write(level, ...args) {
    const now = new Date();
    const time = now.toISOString();
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    this.stream.write(`[${time}] [${level}] ${msg}\n`);
  }

  startDailyRotation() {
    setInterval(() => {
      const newLogFile = path.join(this.logDir, this._getLogFileName());
      if (newLogFile !== this.logFile) {
        this.stream.end();
        this.logFile = newLogFile;
        this._openStream();
      }
    }, 60 * 1000); // Check every minute
  }
}

module.exports = Logger;
