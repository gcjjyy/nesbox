import { useId } from "react";

export function ArcadeCabinet({ cover, title = "MAME", onCoverError }: {
  cover?: string;
  title?: string;
  onCoverError?: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const paint = (name: string) => `url(#${id}-${name})`;
  // Match the cabinet's 13 / 467 outward slope, retaining rounded CRT corners.
  const screenOutline = "M151.4 38H908.6Q941.6 38 942.5 71L952.3 422Q953.2 455 920.2 455H139.8Q106.8 455 107.7 422L117.5 71Q118.4 38 151.4 38Z";
  return (
    <svg className="arcade-grid-machine" viewBox="0 0 1060 704" role="img"
      aria-label="MAME 아케이드 게임기" data-grid-ratio="1060:704">
      <title>{`${title} — 브라운관과 조이스틱`}</title>
      <defs>
        <linearGradient id={`${id}-case`} x2="0" y2="1">
          <stop stopColor="#393c3b"/><stop offset=".35" stopColor="#242725"/><stop offset="1" stopColor="#111514"/>
        </linearGradient>
        <linearGradient id={`${id}-trim`} x2="1" y2=".1">
          <stop stopColor="#737974"/><stop offset=".25" stopColor="#c2c4b7"/><stop offset=".65" stopColor="#8d948c"/><stop offset="1" stopColor="#414944"/>
        </linearGradient>
        <linearGradient id={`${id}-deck`} x2=".1" y2="1">
          <stop stopColor="#454d46"/><stop offset=".5" stopColor="#303b34"/><stop offset="1" stopColor="#1c2923"/>
        </linearGradient>
        <linearGradient id={`${id}-metal`}>
          <stop stopColor="#303d36"/><stop offset=".45" stopColor="#dce2d8"/><stop offset=".65" stopColor="#8d9c92"/><stop offset="1" stopColor="#39483e"/>
        </linearGradient>
        <radialGradient id={`${id}-red`} cx=".32" cy=".22" r=".8">
          <stop stopColor="#ffb2a0"/><stop offset=".22" stopColor="#e95942"/><stop offset=".65" stopColor="#b62621"/><stop offset="1" stopColor="#5a1315"/>
        </radialGradient>
        <radialGradient id={`${id}-button`} cx=".35" cy=".15" r=".95">
          <stop stopColor="#f39469"/><stop offset=".28" stopColor="#d65a3d"/><stop offset=".9" stopColor="#853020"/>
        </radialGradient>
        <radialGradient id={`${id}-service-button`} cx=".35" cy=".18" r=".9">
          <stop stopColor="#fff0a1"/><stop offset=".45" stopColor="#f0c635"/><stop offset="1" stopColor="#b58a19"/>
        </radialGradient>
        <linearGradient id={`${id}-glass`} x2="1" y2="1">
          <stop stopColor="#d9f3eb" stopOpacity=".17"/><stop offset=".36" stopColor="#d9f3eb" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".1"/>
        </linearGradient>
        <clipPath id={`${id}-screen`}><path d={screenOutline}/></clipPath>
        <pattern id={`${id}-lines`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 3.5H4" stroke="#000" strokeOpacity=".13"/>
        </pattern>
      </defs>
      {/* The monitor and deck share one compact silhouette; all controls stay inside it. */}
      <path d="M71 8H989L1005 482L1054 647V685Q1054 700 1035 700H25Q6 700 6 685V647L55 482Z"
        fill="#101715" stroke="#515b53" strokeWidth="3"/>
      <path d="M82 15H978L991 482H69Z" fill={paint("case")}/>
      <path d="M74 10H91L78 483L29 650H9L59 481Z" fill={paint("trim")}/>
      <path d="M969 10H986L1001 481L1051 650H1031L982 483Z" fill={paint("trim")}/>
      <path d="M105 27H955" stroke="#62675e" strokeOpacity=".45" strokeWidth="2"/>
      <g className="arcade-grid-machine__screen" clipPath={paint("screen")}>
        <rect x="106.4" y="38" width="847.2" height="417" fill="#07120e"/>
        {/* The fallback remains visible if loading fails before hydration attaches onError. */}
        <text x="530" y="263" textAnchor="middle" fill="#c5d5ab" fontSize="30" fontFamily="monospace">INSERT COIN</text>
        {cover && <image href={cover} x="106.4" y="38" width="847.2" height="417" preserveAspectRatio="none" onError={onCoverError}/>}
        <rect x="106.4" y="38" width="847.2" height="417" fill={paint("lines")}/>
        <rect x="106.4" y="38" width="847.2" height="417" fill={paint("glass")}/>
      </g>
      <path d={screenOutline} fill="none" stroke="#51594f" strokeWidth="3"/>
      <path d="M125.4 76Q126.4 46 151.4 46H895.6" fill="none" stroke="#d0e4d7" strokeOpacity=".17" strokeWidth="3"/>
      <path d="M79 482H981L1032 646H28Z" fill={paint("deck")} stroke="#738074" strokeWidth="2"/>
      <path d="M80 484H980L986 504H74Z" fill="#141e19"/>
      <path d="M42 621H1018L1023 634H37Z" fill="#bc5b39"/>
      <path d="M38 636H1022" stroke="#e1af78" strokeWidth="2"/>
      <path d="M28 648H1032V683H28Z" fill="#131e18"/>
      <path d="M30 650H1030" stroke="#596557" strokeWidth="3"/>
      <text x="61" y="674" fill="#879584" fontFamily="monospace" fontSize="12" letterSpacing="3">NESBOX</text>
      <text x="998" y="674" textAnchor="end" fill="#879584" fontFamily="monospace" fontSize="12" letterSpacing="3">ARCADE SYSTEM</text>
      {[ [92,523], [968,523], [69,607], [991,607] ].map(([x,y]) => (
        <g key={x}><circle cx={x} cy={y} r="5" fill="#75806f" stroke="#101610" strokeWidth="1.5"/><path d={`M${x-2} ${y+2}l4-4`} stroke="#263025"/></g>
      ))}
      <g aria-label="조이스틱">
        <ellipse cx="294" cy="583" rx="72" ry="24" fill="#101b14" stroke="#68765f" strokeWidth="3"/>
        <ellipse cx="294" cy="580" rx="49" ry="15" fill="#070f0a" stroke="#293e2c" strokeWidth="2"/>
        <path d="M287 504H301L302 579Q294 587 286 579Z" fill={paint("metal")}/>
        <circle cx="297" cy="487" r="36" fill="#090e0b" opacity=".45" transform="translate(6 8)"/>
        <circle cx="294" cy="478" r="36" fill={paint("red")} stroke="#6d221c" strokeWidth="2"/>
        <ellipse cx="283" cy="462" rx="10" ry="6" fill="#ffe0bd" opacity=".33" transform="rotate(-25 283 462)"/>
      </g>
      {[ [570,533], [654,520], [738,526], [587,590], [671,577], [755,583] ].map(([x,y], index) => (
        <g key={index} data-arcade-button={index+1} aria-label={`버튼 ${index+1}`}>
          <ellipse cx={x} cy={y+7} rx="33" ry="23" fill="#08110b" stroke="#303831" strokeWidth="2"/>
          <ellipse cx={x} cy={y+2} rx="26" ry="20" fill="#67251a"/>
          <ellipse cx={x} cy={y-3} rx="25" ry="18" fill={paint("button")} stroke="#793625" strokeWidth="1.5"/>
          <path d={`M${x-16} ${y-9}q14-12 30-1`} fill="none" stroke="#f1ae88" strokeOpacity=".25" strokeWidth="2"/>
        </g>
      ))}
      {[{ x: 862, label: "COIN" }, { x: 923, label: "START" }].map(({ x, label }) => (
        <g key={label} aria-label={label}>
          <g transform={`translate(${x} 534) scale(.8) translate(${-x} -534)`}>
            <ellipse cx={x+2} cy="547" rx="27" ry="18" fill="#0b130e" opacity=".4"/>
            <ellipse cx={x} cy="543" rx="26" ry="18" fill="#101812" stroke="#303831" strokeWidth="1.5"/>
            <ellipse cx={x} cy="539" rx="21" ry="15" fill="#8d6812"/>
            <ellipse cx={x} cy="534" rx="21" ry="15" fill={paint("service-button")} stroke="#a47b16" strokeWidth="1"/>
            <path d={`M${x-14} 528q12-9 26-1`} fill="none" stroke="#fff7cc" strokeOpacity=".35" strokeWidth="1.5"/>
            <g transform={`translate(${x} 534) scale(1 .72)`}>
              {label === "COIN" ? <g fill="none" stroke="#4f3c16" strokeWidth="1.7">
                <circle r="7"/><path d="M-2-3h2v6m-2 0h4" strokeLinejoin="round"/>
              </g> : <g fill="#4f3c16">
                <circle cy="-5" r="2.5"/>
                <path d="M-4 1Q-4-1 0-1T4 1V4H2.5V9H.5V4h-1V9h-2V4H-4Z"/>
              </g>}
            </g>
          </g>
          <text x={x} y="570" fill="#909b87" fontFamily="monospace" fontSize="10" letterSpacing="1.4" textAnchor="middle">{label}</text>
        </g>
      ))}
    </svg>
  );
}
