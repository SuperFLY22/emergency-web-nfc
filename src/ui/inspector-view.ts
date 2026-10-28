import type { NFCService } from '../nfc/nfc-service';
import type { LoggerView } from './logger-view';
import type { ScanResult } from '../nfc/types';

const STORAGE_KEY = 'nfc_inspection_history';

export class InspectorView {
  private container: HTMLElement;
  private nfcService: NFCService;
  private logger: LoggerView;

  private scanToggleBtn!: HTMLButtonElement;
  private scanStateIndicator!: HTMLElement;
  private currentResultCard!: HTMLElement;
  private historyListEl!: HTMLElement;
  private historyItems: ScanResult[] = [];

  constructor(containerId: string, nfcService: NFCService, logger: LoggerView) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Inspector container #${containerId} not found`);
    this.container = el;
    this.nfcService = nfcService;
    this.logger = logger;

    this.loadHistory();
    this.render();
    this.cacheDom();
    this.setupEvents();
    this.renderHistory();
  }

  private loadHistory(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.historyItems = JSON.parse(data);
      }
    } catch {
      this.historyItems = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.historyItems.slice(0, 20)));
    } catch {
      // 무시
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="card inspector-card">
        <div class="card-header">
          <div class="badge-tag inspector">INSPECTOR SCAN</div>
          <h2 class="card-title">2. 현장 점검자 태그 스캔</h2>
          <p class="card-desc">스캔 모드를 켜고 장비의 NFC 태그에 스마트폰을 대면 점검 정보가 즉시 표시됩니다.</p>
        </div>

        <!-- 스캔 컨트롤러 -->
        <div class="scan-control-box">
          <div class="radar-box" id="scanRadar">
            <div class="radar-circle circle-1"></div>
            <div class="radar-circle circle-2"></div>
            <div class="radar-icon">📱</div>
          </div>
          <div id="scanStateText" class="scan-state-text">스캔 대기 중 (중지됨)</div>

          <button type="button" id="scanToggleBtn" class="btn btn-secondary btn-large">
            <span class="btn-icon">🔍</span>
            <span class="btn-text">NFC 스캔 시작</span>
          </button>
        </div>

        <!-- 스캔된 최신 결과 카드 (동적 렌더링) -->
        <div id="currentResultContainer" class="latest-result-container hidden"></div>

        <!-- 최근 점검 히스토리 -->
        <div class="history-section">
          <div class="history-header">
            <h3>최근 스캔 기록</h3>
            <button type="button" id="clearHistoryBtn" class="btn-text-link">기록 삭제</button>
          </div>
          <div id="historyList" class="history-list"></div>
        </div>
      </div>
    `;
  }

  private cacheDom(): void {
    this.scanToggleBtn = this.container.querySelector('#scanToggleBtn') as HTMLButtonElement;
    this.scanStateIndicator = this.container.querySelector('#scanStateText') as HTMLElement;
    this.currentResultCard = this.container.querySelector('#currentResultContainer') as HTMLElement;
    this.historyListEl = this.container.querySelector('#historyList') as HTMLElement;
  }

  private setupEvents(): void {
    this.scanToggleBtn.addEventListener('click', () => {
      if (this.nfcService.getScanningState()) {
        this.stopScan();
      } else {
        void this.startScan();
      }
    });

    const clearHistoryBtn = this.container.querySelector('#clearHistoryBtn');
    clearHistoryBtn?.addEventListener('click', () => {
      if (confirm('모든 스캔 이력을 삭제하시겠습니까?')) {
        this.historyItems = [];
        this.saveHistory();
        this.renderHistory();
        this.logger.addLog('info', '스캔 히스토리가 초기화되었습니다.');
      }
    });
  }

  private async startScan(): Promise<void> {
    try {
      this.updateScanUI(true);
      this.logger.addLog('info', '[스캔 시작] NDEFReader 리스너 활성화됨. 태그 접촉 대기 중...');

      await this.nfcService.startScan(
        (result: ScanResult) => {
          this.handleScanResult(result);
        },
        (error: Error) => {
          this.logger.addLog('error', `[스캔 에러] ${error.message}`);
          this.updateScanUI(false);
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.addLog('error', `[스캔 시작 실패] ${msg}`);
      alert(`스캔 시작 실패: ${msg}`);
      this.updateScanUI(false);
    }
  }

  public stopScan(): void {
    this.nfcService.stopScan();
    this.updateScanUI(false);
    this.logger.addLog('info', '[스캔 중단] NFC 스캐너가 대기 모드로 전환되었습니다.');
  }

  private updateScanUI(isScanning: boolean): void {
    const radar = this.container.querySelector('#scanRadar');
    if (isScanning) {
      radar?.classList.add('active');
      this.scanStateIndicator.textContent = '스마트폰 뒷면에 태그를 접촉하세요...';
      this.scanStateIndicator.classList.add('scanning');
      this.scanToggleBtn.classList.remove('btn-secondary');
      this.scanToggleBtn.classList.add('btn-danger');
      this.scanToggleBtn.innerHTML = `
        <span class="btn-icon">⏹</span>
        <span class="btn-text">스캔 중지</span>
      `;
    } else {
      radar?.classList.remove('active');
      this.scanStateIndicator.textContent = '스캔 대기 중 (중지됨)';
      this.scanStateIndicator.classList.remove('scanning');
      this.scanToggleBtn.classList.remove('btn-danger');
      this.scanToggleBtn.classList.add('btn-secondary');
      this.scanToggleBtn.innerHTML = `
        <span class="btn-icon">🔍</span>
        <span class="btn-text">NFC 스캔 시작</span>
      `;
    }
  }

  private handleScanResult(result: ScanResult): void {
    this.logger.addLog('success', `[태그 감지] ID: ${result.id} (UID: ${result.serialNumber})`);
    if (result.targetUrl) {
      this.logger.addLog('info', `[URL 발견]: ${result.targetUrl}`);
    }

    // 히스토리 추가
    this.historyItems.unshift(result);
    this.saveHistory();

    // 결과 카드 렌더링
    this.renderResultCard(result);
    this.renderHistory();
  }

  private renderResultCard(result: ScanResult): void {
    this.currentResultCard.classList.remove('hidden');
    this.currentResultCard.innerHTML = `
      <div class="result-card-inner">
        <div class="result-header">
          <span class="result-badge">방금 스캔됨</span>
          <span class="result-time">${result.timestamp}</span>
        </div>
        <div class="result-body">
          <div class="result-row">
            <span class="res-label">장비 ID:</span>
            <span class="res-value font-mono highlight">${this.escapeHtml(result.id)}</span>
          </div>
          <div class="result-row">
            <span class="res-label">태그 UID:</span>
            <span class="res-value font-mono text-muted">${this.escapeHtml(result.serialNumber)}</span>
          </div>
          ${
            result.textData
              ? `
          <div class="result-row">
            <span class="res-label">텍스트 정보:</span>
            <span class="res-value">${this.escapeHtml(result.textData)}</span>
          </div>`
              : ''
          }
          ${
            result.targetUrl
              ? `
          <div class="result-row">
            <span class="res-label">점검 URL:</span>
            <span class="res-value text-break">
              <a href="${this.escapeHtml(result.targetUrl)}" target="_blank" rel="noopener noreferrer" class="link-url">
                ${this.escapeHtml(result.targetUrl)}
              </a>
            </span>
          </div>
          <a href="${this.escapeHtml(result.targetUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-inspect-link">
            🚀 점검 페이지로 바로 이동
          </a>`
              : `
          <div class="notice-box">태그에 기록된 URL 레코드가 없습니다.</div>`
          }
        </div>
      </div>
    `;
  }

  private renderHistory(): void {
    if (this.historyItems.length === 0) {
      this.historyListEl.innerHTML = `<div class="history-empty">아직 스캔된 이력이 없습니다.</div>`;
      return;
    }

    this.historyListEl.innerHTML = this.historyItems
      .slice(0, 10)
      .map(
        (item) => `
        <div class="history-item">
          <div class="hist-main">
            <span class="hist-id">${this.escapeHtml(item.id)}</span>
            <span class="hist-time">${item.timestamp}</span>
          </div>
          <div class="hist-sub">
            <span class="hist-uid">UID: ${this.escapeHtml(item.serialNumber)}</span>
            ${
              item.targetUrl
                ? `<a href="${this.escapeHtml(item.targetUrl)}" target="_blank" rel="noopener noreferrer" class="hist-link">점검 열기 ↗</a>`
                : ''
            }
          </div>
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
