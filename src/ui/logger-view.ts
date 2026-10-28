import type { LogEntry, LogLevel } from '../nfc/types';

export class LoggerView {
  private container: HTMLElement;
  private logBox: HTMLElement;
  private logs: LogEntry[] = [];

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Logger container #${containerId} not found`);
    this.container = el;
    this.container.innerHTML = `
      <div class="log-card">
        <div class="log-header">
          <div class="log-title">
            <span class="status-dot live"></span>
            <span>시스템 로그 실시간 콘솔</span>
          </div>
          <div class="log-actions">
            <button id="copyLogBtn" class="btn-xs" title="로그 복사">복사</button>
            <button id="clearLogBtn" class="btn-xs" title="로그 초기화">비우기</button>
          </div>
        </div>
        <div id="logConsole" class="log-console" role="log" aria-live="polite"></div>
      </div>
    `;

    this.logBox = this.container.querySelector('#logConsole') as HTMLElement;
    this.setupListeners();
  }

  private setupListeners(): void {
    const copyBtn = this.container.querySelector('#copyLogBtn');
    const clearBtn = this.container.querySelector('#clearLogBtn');

    copyBtn?.addEventListener('click', async () => {
      const text = this.logs
        .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
        .join('\n');
      try {
        await navigator.clipboard.writeText(text);
        this.addLog('info', '로그가 클립보드에 복사되었습니다.');
      } catch {
        alert('복사 권한이 거부되었거나 지원되지 않습니다.');
      }
    });

    clearBtn?.addEventListener('click', () => {
      this.logs = [];
      this.render();
      this.addLog('info', '로그 콘솔이 초기화되었습니다.');
    });
  }

  public addLog(level: LogLevel, message: string, details?: unknown): void {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
    const entry: LogEntry = {
      timestamp: timeStr,
      level,
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
    this.render();
  }

  private render(): void {
    if (this.logs.length === 0) {
      this.logBox.innerHTML = `<div class="log-empty">> 시스템 대기 중...</div>`;
      return;
    }

    this.logBox.innerHTML = this.logs
      .map(
        (log) => `
        <div class="log-line log-${log.level}">
          <span class="log-time">[${log.timestamp}]</span>
          <span class="log-badge ${log.level}">${log.level.toUpperCase()}</span>
          <span class="log-msg">${this.escapeHtml(log.message)}</span>
        </div>
      `
      )
      .join('');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
