import type { EquipmentInfo, NFCSupportStatus, ScanResult } from './types';

export class NFCService {
  private ndefReader: NDEFReader | null = null;
  private abortController: AbortController | null = null;
  private isScanning = false;

  public checkSupport(): NFCSupportStatus {
    const isSecure = window.isSecureContext;
    const hasNDEF = 'NDEFReader' in window;

    if (!isSecure) {
      return {
        isSupported: false,
        isSecureContext: false,
        reason: '안전하지 않은 환경(Insecure Context). HTTPS 배포 또는 localhost(USB Port Forwarding)로 접속해야 합니다.',
      };
    }

    if (!hasNDEF) {
      return {
        isSupported: false,
        isSecureContext: true,
        reason: '브라우저 미지원: Web NFC는 안드로이드 크롬(Chrome for Android 89+) 전용 기능입니다.',
      };
    }

    return {
      isSupported: true,
      isSecureContext: true,
      reason: 'Web NFC를 정상적으로 사용할 수 있습니다.',
    };
  }

  public triggerHaptic(type: 'success' | 'tap' | 'error' = 'tap'): void {
    if ('vibrate' in navigator) {
      try {
        if (type === 'success') {
          navigator.vibrate([100, 50, 100]);
        } else if (type === 'error') {
          navigator.vibrate([200, 100, 200]);
        } else {
          navigator.vibrate(50);
        }
      } catch {
        // 일부 브라우저에서 무시될 수 있음
      }
    }
  }

  public async startScan(
    onReading: (result: ScanResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const support = this.checkSupport();
    if (!support.isSupported) {
      throw new Error(support.reason || 'Web NFC를 사용할 수 없는 환경입니다.');
    }

    if (this.isScanning) {
      this.stopScan();
    }

    try {
      this.abortController = new AbortController();
      this.ndefReader = new NDEFReader();

      await this.ndefReader.scan({ signal: this.abortController.signal });
      this.isScanning = true;

      this.ndefReader.onreading = (event: NDEFReadingEvent) => {
        this.triggerHaptic('success');
        const serialNumber = event.serialNumber || '알 수 없음';
        const rawRecords: ScanResult['rawRecords'] = [];
        let targetUrl: string | undefined;
        let textData: string | undefined;
        let equipmentId = '미지정';

        for (const record of event.message.records) {
          const decoder = new TextDecoder(record.encoding || 'utf-8');
          const dataText = record.data ? decoder.decode(record.data) : '';

          rawRecords.push({
            recordType: record.recordType,
            mediaType: record.mediaType,
            data: dataText,
          });

          if (record.recordType === 'url') {
            targetUrl = dataText;
            try {
              const urlObj = new URL(dataText);
              const queryId = urlObj.searchParams.get('id');
              if (queryId) equipmentId = queryId;
            } catch {
              // URL 파싱 에러 무시
            }
          } else if (record.recordType === 'text') {
            if (!textData) textData = dataText;
            if (equipmentId === '미지정' && dataText.trim().length > 0) {
              equipmentId = dataText.trim();
            }
          }
        }

        const now = new Date();
        const formattedTime = now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) + ' ' + now.toLocaleTimeString('ko-KR', { hour12: false });

        const scanResult: ScanResult = {
          id: equipmentId,
          serialNumber,
          timestamp: formattedTime,
          targetUrl,
          textData,
          rawRecords,
        };

        onReading(scanResult);
      };

      this.ndefReader.onreadingerror = () => {
        this.triggerHaptic('error');
        onError(new Error('태그 인식 오류: 태그 규격(NFC Forum Type 1~5)이 맞는지 또는 태그가 너무 빨리 떨어졌는지 확인해주세요.'));
      };
    } catch (err: unknown) {
      this.isScanning = false;
      const error = err instanceof Error ? err : new Error(String(err));
      onError(this.formatErrorMessage(error));
    }
  }

  public stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.ndefReader = null;
    this.isScanning = false;
  }

  public getScanningState(): boolean {
    return this.isScanning;
  }

  public async writeTag(info: EquipmentInfo): Promise<void> {
    const support = this.checkSupport();
    if (!support.isSupported) {
      throw new Error(support.reason || 'Web NFC 미지원 환경');
    }

    const ndef = new NDEFReader();

    // NDEF 레코드 준비:
    // 1) URL 레코드 (스마트폰 기본 카메라/NFC로 터치 시 브라우저 바로 실행되는 표준 NDEF 규격)
    // 2) Text 레코드 (장비 ID 및 이름 백업 메타데이터)
    const records: NDEFRecordInit[] = [
      {
        recordType: 'url',
        data: info.targetUrl,
      },
      {
        recordType: 'text',
        data: `${info.id} | ${info.name}`,
      },
    ];

    try {
      await ndef.write({ records });
      this.triggerHaptic('success');
    } catch (err: unknown) {
      this.triggerHaptic('error');
      const error = err instanceof Error ? err : new Error(String(err));
      throw this.formatErrorMessage(error);
    }
  }

  private formatErrorMessage(error: Error): Error {
    if (error.name === 'NotAllowedError') {
      return new Error('NFC 접근 권한이 거부되었습니다. 스마트폰 상단바에서 NFC를 켜고 사이트 권한을 허용해주세요.');
    }
    if (error.name === 'NotSupportedError') {
      return new Error('해당 기기에서 NFC를 지원하지 않거나 읽기 전용 태그입니다.');
    }
    if (error.name === 'NetworkError') {
      return new Error('NFC 통신 실패: 태그와의 접촉이 불안정하거나 너무 일찍 떨어졌습니다. 태그를 밀착시켜주세요.');
    }
    if (error.name === 'AbortError') {
      return new Error('스캔 또는 쓰기 작업이 취소되었습니다.');
    }
    return error;
  }
}
