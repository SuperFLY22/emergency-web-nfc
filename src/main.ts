import { NFCService } from './nfc/nfc-service';
import { LoggerView } from './ui/logger-view';
import { AdminView } from './ui/admin-view';
import { InspectorView } from './ui/inspector-view';

class App {
  private nfcService: NFCService;
  private logger: LoggerView;
  private inspectorView!: InspectorView;

  constructor() {
    this.nfcService = new NFCService();
    this.logger = new LoggerView('loggerContainer');
    this.initViews();
    this.checkEnvironment();
    this.setupTabs();
  }

  private initViews(): void {
    new AdminView('adminContainer', this.nfcService, this.logger);
    this.inspectorView = new InspectorView('inspectorContainer', this.nfcService, this.logger);
  }

  private checkEnvironment(): void {
    const status = this.nfcService.checkSupport();
    const envBadge = document.getElementById('envBadge');
    const noticeBanner = document.getElementById('securityNoticeBanner');

    if (!status.isSecureContext) {
      if (envBadge) {
        envBadge.className = 'status-pill status-danger';
        envBadge.innerHTML = `⚠️ 보안 컨텍스트 위반 (Insecure HTTP)`;
      }
      if (noticeBanner) {
        noticeBanner.classList.remove('hidden');
      }
      this.logger.addLog(
        'error',
        '보안 정책 오류: Web NFC는 HTTPS 또는 localhost 환경에서만 작동합니다. IP 주소(192.168.x.x) 직접 접속 시 작동하지 않습니다.'
      );
      this.logger.addLog(
        'warn',
        '해결책: Chrome DevTools Port Forwarding(localhost:5173)을 사용하거나 Vercel로 배포하세요.'
      );
    } else if (!status.isSupported) {
      if (envBadge) {
        envBadge.className = 'status-pill status-warn';
        envBadge.innerHTML = `⚠️ Web NFC 미지원 브라우저`;
      }
      this.logger.addLog('warn', status.reason || 'Web NFC 미지원 기기');
    } else {
      if (envBadge) {
        envBadge.className = 'status-pill status-success';
        envBadge.innerHTML = `⚡ Web NFC 준비 완료 (Ready)`;
      }
      this.logger.addLog('success', 'Web NFC API가 성공적으로 활성화되었습니다.');
    }
  }

  private setupTabs(): void {
    const tabAdmin = document.getElementById('tabAdminBtn');
    const tabInspector = document.getElementById('tabInspectorBtn');
    const adminContainer = document.getElementById('adminContainer');
    const inspectorContainer = document.getElementById('inspectorContainer');

    tabAdmin?.addEventListener('click', () => {
      tabAdmin.classList.add('active');
      tabInspector?.classList.remove('active');
      adminContainer?.classList.remove('hidden');
      inspectorContainer?.classList.add('hidden');
      // 탭 전환 시 읽기 스캔이 켜져있다면 중단하여 자원 절약
      if (this.nfcService.getScanningState()) {
        this.inspectorView.stopScan();
      }
    });

    tabInspector?.addEventListener('click', () => {
      tabInspector.classList.add('active');
      tabAdmin?.classList.remove('active');
      inspectorContainer?.classList.remove('hidden');
      adminContainer?.classList.add('hidden');
    });

    // 안내 배너 닫기 토글
    const dismissBtn = document.getElementById('dismissNoticeBtn');
    dismissBtn?.addEventListener('click', () => {
      const noticeBanner = document.getElementById('securityNoticeBanner');
      noticeBanner?.classList.add('hidden');
    });
  }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
