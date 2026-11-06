import type { SVGProps } from "react";

export function NesboxWordmark({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      className={`nesbox-wordmark${className ? ` ${className}` : ""}`}
      viewBox="0 0 748 168"
      role="img"
      aria-label="NESBOX"
      focusable="false"
    >
      <title>NESBOX</title>
      <path className="nesbox-wordmark__rail" d="M17 33v102h27M731 33v102h-27" />
      <path
        data-letter="N"
        className="nesbox-wordmark__letter nesbox-wordmark__letter--nes"
        d="M46 126V42h23l49 52V42h27v84h-23L73 74v52Z"
      />
      <path
        data-letter="E"
        className="nesbox-wordmark__letter nesbox-wordmark__letter--nes"
        d="M164 42h91v21h-64v12h55v20h-55v11h66v20h-93Z"
      />
      <path
        data-letter="S"
        className="nesbox-wordmark__letter nesbox-wordmark__letter--nes"
        d="M287 42h88v21h-64v12h43c17 0 26 8 26 23v7c0 14-10 21-27 21h-70v-21h70V94h-43c-17 0-25-8-25-23v-7c0-14 9-22 27-22Z"
      />
      <path
        data-letter="B"
        className="nesbox-wordmark__letter nesbox-wordmark__letter--box"
        fillRule="evenodd"
        d="M406 42h62c20 0 30 9 30 25v7c0 8-4 14-12 18 10 4 15 11 15 20v1c0 9-4 13-10 13h-85Zm27 20v20h31c5 0 8-3 8-9v-2c0-6-3-9-9-9Zm0 38v7h39c2 0 3-1 3-3 0-3-3-4-8-4Z"
      />
      <path
        data-letter="O"
        className="nesbox-wordmark__letter nesbox-wordmark__letter--box"
        fillRule="evenodd"
        d="M524 42h62c19 0 29 9 29 27v30c0 18-10 27-29 27h-62c-18 0-28-9-28-27V69c0-18 10-27 28-27Zm0 21v42h63V63Z"
      />
      <path
        data-letter="X"
        className="nesbox-wordmark__letter nesbox-wordmark__letter--box"
        d="M624 42h34l20 26 20-26h34l-37 41 39 43h-35l-21-27-22 27h-35l40-43Z"
      />
      <path className="nesbox-wordmark__signal" d="M47 139h315l12 9 13-18 13 9h302" />
      <circle className="nesbox-wordmark__signal-dot" cx="714" cy="139" r="4" />
    </svg>
  );
}
