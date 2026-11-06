const ACTION_BUTTONS = [1, 2, 3, 4, 5, 6] as const;

export function ArcadeCabinetPreview() {
  return (
    <div className="arcade-cabinet-preview" role="img" aria-label="NESBOX MAME 업라이트 캐비닛 시안">
      <div className="arcade-cabinet-preview__shadow" aria-hidden />
      <div className="arcade-cabinet">
        <div className="arcade-cabinet__top-cap" aria-hidden />
        <div className="arcade-cabinet__marquee">
          <span className="arcade-cabinet__marquee-kicker">THE HOME OF CLASSICS</span>
          <strong><span>NESBOX</span> ARCADE</strong>
          <i aria-hidden />
        </div>

        <div className="arcade-cabinet__screen-section">
          <div className="arcade-cabinet__speaker" aria-hidden>
            {Array.from({ length: 16 }, (_, index) => <i key={index} />)}
          </div>
          <div className="arcade-cabinet__bezel">
            <div className="arcade-cabinet__crt">
              <div className="arcade-cabinet__scanlines" aria-hidden />
              <div className="arcade-attract-screen">
                <span className="arcade-attract-screen__high-score">HI · 019940</span>
                <div className="arcade-attract-screen__mark" aria-hidden>
                  <span>N</span><span>B</span>
                </div>
                <strong>INSERT COIN</strong>
                <small>1 COIN · 1 PLAY</small>
              </div>
            </div>
          </div>
          <div className="arcade-cabinet__screen-label">
            <span>25″ COLOR CRT</span>
            <b>PLAYER 1</b>
          </div>
        </div>

        <div className="arcade-control-deck">
          <div className="arcade-control-deck__top">
            <div className="arcade-joystick">
              <span className="arcade-joystick__ball" aria-hidden />
              <span className="arcade-joystick__shaft" aria-hidden />
              <span className="arcade-joystick__boot" aria-hidden />
              <small>JOYSTICK</small>
            </div>
            <div className="arcade-action-buttons" aria-label="6버튼 배열">
              {ACTION_BUTTONS.map((button) => (
                <span key={button} data-arcade-button={button} aria-label={`버튼 ${button}`}>
                  <i aria-hidden />
                  <small>{button}</small>
                </span>
              ))}
            </div>
          </div>
          <div className="arcade-control-deck__front">
            <span>SHIFT · COIN</span>
            <div>
              <i aria-hidden />
              <b>1P START</b>
            </div>
            <span>ENTER · START</span>
          </div>
        </div>

        <div className="arcade-cabinet__lower">
          <div className="arcade-cabinet__instruction">
            <span>MOVE</span><b>↑ ↓ ← →</b>
            <i aria-hidden />
            <span>BUTTONS</span><b>Z X C · A S D</b>
          </div>
          <div className="arcade-cabinet__coin-door">
            <div><i aria-hidden /><span>COIN</span></div>
            <div><i aria-hidden /><span>RETURN</span></div>
          </div>
          <div className="arcade-cabinet__vents" aria-hidden>
            {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
          </div>
          <small className="arcade-cabinet__maker">NESBOX SYSTEMS · KOREA</small>
        </div>
      </div>
    </div>
  );
}
