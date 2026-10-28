import type { NFCService } from '../nfc/nfc-service';
import type { LoggerView } from './logger-view';
import type { EquipmentInfo } from '../nfc/types';

export class AdminView {
  private container: HTMLElement;
  private nfcService: NFCService;
  private logger: LoggerView;

  private eqIdInput!: HTMLInputElement;
  private eqNameInput!: HTMLInputElement;
  private eqTypeSelect!: HTMLSelectElement;
  private eqUrlInput!: HTMLInputElement;
  private writeBtn!: HTMLButtonElement;
  private statusBanner!: HTMLElement;

  private presets = [
    { label: '🫀 AED (자동심장충격기)', idPrefix: 'AED', name: '자동심장충격기 1번', type: 'AED' },
    { label: '🧯 소화기 (분말 3.3kg)', idPrefix: 'EXT', name: '분말소화기 A동 3층', type: 'EXTINGUISHER' },
    { label: '🧗 완강기 (비상탈출)', idPrefix: 'ESC', name: '간이완강기 4층', type: 'ESCAPE' },
    { label: '🩹 구급함', idPrefix: 'MED', name: '응급구급키트 B구역', type: 'FIRST_AID' },
  ];

  constructor(containerId: string, nfcService: NFCService, logger: LoggerView) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Admin container #${containerId} not found`);
    this.container = el;
    this.nfcService = nfcService;
    this.logger = logger;

    this.render();
    this.cacheDom();
    this.setupEvents();
  }

  private render(): void {
    const defaultHost = window.location.origin.includes('localhost')
      ? 'https://safety-inspect.vercel.app'
      : window.location.origin;

    this.container.innerHTML = `
      <div class="card admin-card">
        <div class="card-header">
          <div class="badge-tag">ADMIN WRITE</div>
          <h2 class="card-title">1. 비상장비 NFC 태그 쓰기</h2>
          <p class="card-desc">장비 정보와 점검 URL을 NFC 태그에 NDEF 표준 포맷으로 영구 기록합니다.</p>
        </div>

        <!-- 퀵 프리셋 버튼 -->
        <div class="preset-section">
          <span class="field-label">빠른 장비 프리셋</span>
          <div class="preset-chips">
            ${this.presets
              .map(
                (p, idx) => `
              <button type="button" class="preset-chip ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                ${p.label}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <form id="adminWriteForm" class="form-body" onsubmit="return false;">
          <div class="form-row">
            <div class="form-group flex-1">
              <label for="eqId">장비 고유 식별자 (ID)</label>
              <input type="text" id="eqId" value="AED-01" placeholder="예: AED-01, EXT-02" required />
            </div>
            <div class="form-group flex-1">
              <label for="eqType">장비 분류</label>
              <select id="eqType">
                <option value="AED">AED (자동심장충격기)</option>
                <option value="EXTINGUISHER">소화기</option>
                <option value="ESCAPE">완강기/피난기구</option>
                <option value="FIRST_AID">구급함</option>
                <option value="OTHER">기타 비상장비</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="eqName">장비 관리명칭 / 위치</label>
            <input type="text" id="eqName" value="자동심장충격기 1층 로비" placeholder="예: 본관 1층 로비 AED" />
          </div>

          <div class="form-group">
            <label for="eqUrl">연결할 점검 웹 URL (Smart Redirect)</label>
            <input
              type="url"
              id="eqUrl"
              value="${defaultHost}/check?id=AED-01"
              placeholder="https://..."
              required
            />
            <span class="input-hint">💡 스마트폰을 태그에 대면 위 URL이 모바일 브라우저로 자동 열립니다.</span>
          </div>

          <div id="writeStatusBanner" class="status-alert hidden"></div>

          <button type="button" id="startWriteBtn" class="btn btn-primary btn-large">
            <span class="btn-icon">⚡</span>
            <span class="btn-text">NFC 태그에 기록하기</span>
          </button>
        </form>
      </div>
    `;
  }

  private cacheDom(): void {
    this.eqIdInput = this.container.querySelector('#eqId') as HTMLInputElement;
    this.eqNameInput = this.container.querySelector('#eqName') as HTMLInputElement;
    this.eqTypeSelect = this.container.querySelector('#eqType') as HTMLSelectElement;
    this.eqUrlInput = this.container.querySelector('#eqUrl') as HTMLInputElement;
    this.writeBtn = this.container.querySelector('#startWriteBtn') as HTMLButtonElement;
    this.statusBanner = this.container.querySelector('#writeStatusBanner') as HTMLElement;
  }

  private setupEvents(): void {
    // 프리셋 버튼 클릭
    const chipBtns = this.container.querySelectorAll('.preset-chip');
    chipBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        chipBtns.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const idx = Number(target.dataset.idx);
        const preset = this.presets[idx];

        const randomNum = Math.floor(Math.random() * 89) + 10;
        const newId = `${preset.idPrefix}-${randomNum}`;
        this.eqIdInput.value = newId;
        this.eqNameInput.value = preset.name;
        this.eqTypeSelect.value = preset.type;
        this.updateUrl();
      });
    });

    // 장비 ID 변경 시 URL 자동 동기화
    this.eqIdInput.addEventListener('input', () => {
      this.updateUrl();
    });

    // 쓰기 버튼
    this.writeBtn.addEventListener('click', () => {
      void this.handleWrite();
    });
  }

  private updateUrl(): void {
    const id = encodeURIComponent(this.eqIdInput.value.trim());
    try {
      const currentUrl = new URL(this.eqUrlInput.value);
      currentUrl.searchParams.set('id', id);
      this.eqUrlInput.value = currentUrl.toString();
    } catch {
      this.eqUrlInput.value = `https://safety-inspect.vercel.app/check?id=${id}`;
    }
  }

  private async handleWrite(): Promise<void> {
    const id = this.eqIdInput.value.trim();
    const name = this.eqNameInput.value.trim() || id;
    const type = this.eqTypeSelect.value;
    const targetUrl = this.eqUrlInput.value.trim();

    if (!id || !targetUrl) {
      alert('장비 ID와 URL을 모두 입력해주세요.');
      return;
    }

    const info: EquipmentInfo = { id, name, type, targetUrl };

    // 버튼 상태를 대기 중(태그 접촉 안내)으로 전환
    this.setWritingState(true);
    this.logger.addLog('info', `[쓰기 대기] 태그에 기록할 데이터 준비 완료 (ID: ${id})`);
    this.logger.addLog('info', `스마트폰 뒷면 NFC 안테나 부위에 태그를 밀착해주세요...`);

    try {
      await this.nfcService.writeTag(info);
      this.showStatus('success', `✅ 태그 쓰기 완료! 장비 ID [${id}]가 정상 기록되었습니다.`);
      this.logger.addLog('success', `[쓰기 성공] 장비 ID: ${id}, URL: ${targetUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showStatus('error', `❌ 쓰기 실패: ${msg}`);
      this.logger.addLog('error', `[쓰기 오류] ${msg}`);
    } finally {
      this.setWritingState(false);
    }
  }

  private setWritingState(isWriting: boolean): void {
    if (isWriting) {
      this.writeBtn.disabled = true;
      this.writeBtn.classList.add('writing-active');
      this.writeBtn.innerHTML = `
        <span class="spinner"></span>
        <span class="btn-text">스마트폰 뒷면에 태그를 대세요...</span>
      `;
      this.showStatus('warn', '📡 NFC 안테나 활성화됨: 태그를 스마트폰 뒷면에 밀착하세요.');
    } else {
      this.writeBtn.disabled = false;
      this.writeBtn.classList.remove('writing-active');
      this.writeBtn.innerHTML = `
        <span class="btn-icon">⚡</span>
        <span class="btn-text">NFC 태그에 기록하기</span>
      `;
    }
  }

  private showStatus(type: 'success' | 'error' | 'warn', message: string): void {
    this.statusBanner.className = `status-alert alert-${type}`;
    this.statusBanner.textContent = message;
    this.statusBanner.classList.remove('hidden');
  }
}
