import { useEffect, useRef } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

interface InstallGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InstallGuideDialog({ open, onClose }: InstallGuideDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="install-guide"
      aria-labelledby="install-guide-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="install-guide__content">
        <header>
          <div>
            <h2 id="install-guide-title"><Download size={19} aria-hidden />홈 화면에 설치</h2>
            <p>홈 화면 아이콘으로 열면 주소창 없이 플레이할 수 있습니다.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="설치 안내 닫기" title="닫기" autoFocus>
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="install-guide__body">
          <h3>아이폰 · Safari</h3>
          <ol className="install-guide__steps">
            <li><span>1</span><div>Safari에서 NESBOX를 열고 <strong><Share size={15} aria-hidden /> 공유</strong>를 누릅니다.</div></li>
            <li><span>2</span><div>공유 메뉴에서 <strong><SquarePlus size={15} aria-hidden /> 홈 화면에 추가</strong>를 선택합니다.</div></li>
            <li><span>3</span><div><strong>웹 앱으로 열기</strong>가 표시되면 켜고, <strong>추가</strong>를 누릅니다.</div></li>
            <li><span>4</span><div>홈 화면에 생긴 <strong>NESBOX 아이콘</strong>으로 실행합니다.</div></li>
          </ol>
          <p className="install-guide__note">아이폰은 설치 후에도 게임의 가로·세로 방향을 자동으로 고정할 수 없습니다.</p>
          <details className="install-guide__android">
            <summary>안드로이드 · Chrome</summary>
            <p>Chrome의 <strong>⋮ 메뉴 → 설치 및 바로가기 만들기 → 설치</strong>를 선택합니다. 버전에 따라 <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong>로 표시될 수 있습니다.</p>
            <p>설치가 끝나면 홈 화면의 NESBOX 아이콘으로 실행하세요.</p>
          </details>
        </div>
      </div>
    </dialog>
  );
}
