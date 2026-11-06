const ACTION_BUTTONS = [1, 2, 3, 4, 5, 6] as const;

export function ArcadeCabinetPreview() {
  return (
    <div
      className="arcade-grid-machine"
      role="img"
      aria-label="MAME 그리드 카드 시안"
      data-grid-ratio="1060:704"
    >
      <div className="arcade-grid-machine__housing">
        <div className="arcade-grid-machine__screen-frame">
          <div className="arcade-grid-machine__screen">
            <span className="arcade-grid-machine__score">1UP · 019940</span>
            <div className="arcade-grid-machine__scene" aria-hidden>
              <i /><i /><b>VS</b><i /><i />
            </div>
            <strong>INSERT COIN</strong>
            <span className="arcade-grid-machine__scanlines" aria-hidden />
          </div>
        </div>

        <div className="arcade-grid-machine__deck">
          <div className="arcade-grid-machine__joystick" aria-hidden>
            <i className="arcade-grid-machine__ball" />
            <i className="arcade-grid-machine__shaft" />
            <i className="arcade-grid-machine__base" />
          </div>
          <div className="arcade-grid-machine__buttons" aria-label="6버튼 배열">
            {ACTION_BUTTONS.map((button) => (
              <span key={button} data-arcade-button={button} aria-label={`버튼 ${button}`}>
                <i aria-hidden />
              </span>
            ))}
          </div>
          <div className="arcade-grid-machine__system">
            <span><i aria-hidden /> COIN</span>
            <span><i aria-hidden /> 1P</span>
          </div>
        </div>
      </div>
    </div>
  );
}
