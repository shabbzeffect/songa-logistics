/**
 * Songa illustration system — hand-built flat SVG scenes for the demo catalogue.
 * One scene per image hint, all in the brand palette (forest / coral / sun / cream).
 * Real partner photos replace these at onboarding; until then every listing,
 * storefront and hero tile gets a cohesive, recognisable picture.
 */

interface Scene {
  bg: [string, string];
  body: React.ReactNode;
}

function Shadow() {
  return <ellipse cx="200" cy="252" rx="118" ry="16" fill="#0b2b21" opacity="0.12" />;
}

function Steam({ x, color = "#ffffff" }: { x: number; color?: string }) {
  return (
    <path
      d={`M${x},150 c-10,-14 10,-22 0,-36 c-10,-14 10,-22 0,-36`}
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
      opacity="0.85"
    />
  );
}

const SCENES: Record<string, Scene> = {
  stew: {
    bg: ["#fbf3e2", "#eeb469"],
    body: (
      <>
        <Shadow />
        <Steam x={165} />
        <Steam x={200} />
        <Steam x={235} />
        <path d="M108,168 h184 l-22,72 h-140 z" fill="#f2604c" />
        <ellipse cx="200" cy="168" rx="92" ry="18" fill="#d94f3d" />
        <ellipse cx="200" cy="166" rx="74" ry="13" fill="#7a3b1e" />
        <ellipse cx="178" cy="163" rx="10" ry="4" fill="#d9822b" />
        <ellipse cx="214" cy="167" rx="13" ry="5" fill="#a85a24" />
        <ellipse cx="240" cy="163" rx="8" ry="3.5" fill="#d9822b" />
        <rect x="286" y="176" width="14" height="58" rx="7" fill="#0e3a2c" transform="rotate(18 293 205)" />
        <circle cx="152" cy="216" r="5" fill="#f2b544" />
        <circle cx="252" cy="222" r="6" fill="#f2b544" />
        <circle cx="200" cy="230" r="4" fill="#0e3a2c" opacity="0.35" />
      </>
    ),
  },
  rice: {
    bg: ["#fbf7ee", "#f2d06b"],
    body: (
      <>
        <Shadow />
        <Steam x={200} />
        <g transform="rotate(24 200 120)">
          <rect x="120" y="60" width="160" height="10" rx="5" fill="#f2b544" />
          <rect x="130" y="82" width="150" height="10" rx="5" fill="#d94f3d" />
        </g>
        <path d="M110,180 h180 l-24,62 h-132 z" fill="#0e3a2c" />
        <ellipse cx="200" cy="180" rx="90" ry="17" fill="#14503c" />
        <ellipse cx="200" cy="176" rx="66" ry="26" fill="#ffffff" />
        <ellipse cx="172" cy="168" rx="30" ry="18" fill="#f6efe0" />
        <ellipse cx="226" cy="168" rx="28" ry="17" fill="#f6efe0" />
        <circle cx="200" cy="158" r="9" fill="#f2604c" />
        <path d="M200,150 c0,-8 6,-10 6,-16" stroke="#14503c" strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  beans: {
    bg: ["#eef6f0", "#a9cf7a"],
    body: (
      <>
        <Shadow />
        <path d="M112,182 h176 l-22,60 h-132 z" fill="#fbf7ee" />
        <ellipse cx="200" cy="182" rx="88" ry="16" fill="#0e3a2c" />
        <ellipse cx="200" cy="180" rx="70" ry="12" fill="#8aa63d" />
        {[
          [160, 176], [185, 182], [212, 176], [238, 182], [198, 172], [172, 184], [226, 184],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="11" ry="7.5" fill={i % 2 ? "#4c5b22" : "#6d8129"} transform={`rotate(${(i * 37) % 40 - 20} ${x} ${y})`} />
        ))}
        <path d="M258,150 c14,-18 34,-24 52,-22" stroke="#14503c" strokeWidth="6" fill="none" strokeLinecap="round" />
        <ellipse cx="292" cy="126" rx="14" ry="8" fill="#2e9e63" transform="rotate(-24 292 126)" />
      </>
    ),
  },
  juice: {
    bg: ["#ffe9de", "#f4937f"],
    body: (
      <>
        <Shadow />
        <rect x="150" y="96" width="100" height="140" rx="16" fill="#ffffff" opacity="0.55" />
        <rect x="158" y="130" width="84" height="98" rx="10" fill="#f2604c" />
        <rect x="158" y="130" width="84" height="14" rx="7" fill="#ff8a70" />
        <rect x="216" y="56" width="14" height="96" rx="7" fill="#f2b544" transform="rotate(14 223 104)" />
        <circle cx="132" cy="200" r="26" fill="#f2b544" />
        <circle cx="132" cy="200" r="19" fill="#fbf3d9" />
        {[0, 60, 120].map((a) => (
          <line key={a} x1="132" y1="200" x2={132 + 17 * Math.cos((a * Math.PI) / 180)} y2={200 + 17 * Math.sin((a * Math.PI) / 180)} stroke="#f2b544" strokeWidth="4" />
        ))}
        <circle cx="272" cy="150" r="6" fill="#ffffff" opacity="0.8" />
        <circle cx="284" cy="176" r="4" fill="#ffffff" opacity="0.8" />
        <circle cx="266" cy="200" r="5" fill="#ffffff" opacity="0.8" />
      </>
    ),
  },
  veg: {
    bg: ["#e4f2e8", "#7cc79a"],
    body: (
      <>
        <Shadow />
        <path d="M118,178 h164 l-18,64 h-128 z" fill="#8a5a24" />
        <path d="M118,178 h164 l-4,14 h-156 z" fill="#a9742f" />
        {[196, 214, 232].map((y) => (
          <line key={y} x1="128" y1={y} x2="272" y2={y} stroke="#6e4218" strokeWidth="3" opacity="0.5" />
        ))}
        <path d="M160,178 l-14,-52 30,6 z" fill="#f2604c" />
        <path d="M146,126 l-8,-18 m8,18 l-16,-8 m16,8 l2,-18" stroke="#14503c" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="205" cy="152" r="26" fill="#2e9e63" />
        <circle cx="205" cy="152" r="17" fill="#5cc184" />
        <circle cx="252" cy="158" r="20" fill="#f2604c" />
        <path d="M252,138 c2,-8 8,-12 14,-12" stroke="#14503c" strokeWidth="5" fill="none" strokeLinecap="round" />
        <ellipse cx="228" cy="130" rx="12" ry="7" fill="#14503c" transform="rotate(-20 228 130)" />
      </>
    ),
  },
  milk: {
    bg: ["#e4f1fa", "#9cc4e4"],
    body: (
      <>
        <Shadow />
        <rect x="168" y="96" width="64" height="140" rx="20" fill="#ffffff" />
        <rect x="168" y="150" width="64" height="86" rx="18" fill="#dceefb" />
        <path d="M168,168 q16,-12 32,0 t32,0 v-10 h-64 z" fill="#ffffff" />
        <rect x="182" y="74" width="36" height="28" rx="8" fill="#f2604c" />
        <rect x="182" y="120" width="36" height="40" rx="6" fill="#0e3a2c" />
        <circle cx="200" cy="136" r="9" fill="#fbf7ee" />
        <path d="M200,132 v8 m-4,-4 h8" stroke="#0e3a2c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="120" cy="180" r="5" fill="#ffffff" />
        <circle cx="282" cy="150" r="6" fill="#ffffff" />
        <circle cx="272" cy="210" r="4" fill="#ffffff" />
      </>
    ),
  },
  eggs: {
    bg: ["#f6ecd4", "#ddb26a"],
    body: (
      <>
        <Shadow />
        <rect x="104" y="188" width="192" height="52" rx="14" fill="#a9803e" />
        {[136, 200, 264].map((x) => (
          <ellipse key={x} cx={x} cy="190" rx="26" ry="10" fill="#7a5a24" />
        ))}
        <ellipse cx="136" cy="168" rx="24" ry="30" fill="#fdf8ea" />
        <ellipse cx="200" cy="160" rx="24" ry="30" fill="#fdf8ea" />
        <ellipse cx="264" cy="168" rx="24" ry="30" fill="#f3e7cb" />
        <ellipse cx="128" cy="158" rx="6" ry="9" fill="#ffffff" opacity="0.9" />
        <ellipse cx="192" cy="150" rx="6" ry="9" fill="#ffffff" opacity="0.9" />
        <path d="M120,120 c8,-10 20,-12 30,-6" stroke="#8a5a24" strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  grains: {
    bg: ["#f3e7cb", "#c98f3d"],
    body: (
      <>
        <Shadow />
        <path d="M150,140 c0,-24 20,-30 20,-52 h60 c0,22 20,28 20,52 l10,96 h-120 z" fill="#d9a441" />
        <rect x="170" y="66" width="60" height="22" rx="11" fill="#8a5a24" />
        <ellipse cx="200" cy="140" rx="46" ry="14" fill="#8a5a24" />
        <ellipse cx="200" cy="138" rx="38" ry="10" fill="#f2d06b" />
        {[150, 170, 230, 250].map((x, i) => (
          <g key={x} transform={`rotate(${(i - 1.5) * 10} ${x} 120)`}>
            <line x1={x} y1="120" x2={x} y2="60" stroke="#14503c" strokeWidth="4" />
            {[70, 84, 98].map((y) => (
              <ellipse key={y} cx={x} cy={y} rx="5" ry="9" fill="#f2d06b" stroke="#8a5a24" strokeWidth="1.5" />
            ))}
          </g>
        ))}
        <circle cx="140" cy="230" r="4" fill="#f2d06b" />
        <circle cx="262" cy="234" r="5" fill="#f2d06b" />
        <circle cx="238" cy="244" r="3.5" fill="#fbf3d9" />
      </>
    ),
  },
  care: {
    bg: ["#dff0f8", "#7fc6e2"],
    body: (
      <>
        <Shadow />
        <rect x="132" y="72" width="136" height="136" rx="30" fill="#ffffff" />
        <rect x="182" y="96" width="36" height="88" rx="10" fill="#f2604c" />
        <rect x="156" y="122" width="88" height="36" rx="10" fill="#f2604c" />
        <rect x="120" y="196" width="52" height="22" rx="11" fill="#0e3a2c" transform="rotate(-18 146 207)" />
        <rect x="120" y="196" width="26" height="22" rx="11" fill="#fbf7ee" transform="rotate(-18 146 207)" />
        <rect x="228" y="216" width="52" height="22" rx="11" fill="#f2b544" transform="rotate(14 254 227)" />
        <rect x="254" y="216" width="26" height="22" rx="11" fill="#fbf7ee" transform="rotate(14 254 227)" />
        <circle cx="306" cy="96" r="14" fill="#0e3a2c" />
        <path d="M306,88 v16 m-8,-8 h16" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
        <circle cx="96" cy="130" r="10" fill="#0e3a2c" />
        <path d="M96,124 v12 m-6,-6 h12" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  flowers: {
    bg: ["#fbdcea", "#ef87b4"],
    body: (
      <>
        <Shadow />
        <path d="M200,238 L146,150 h108 z" fill="#f2604c" />
        <path d="M200,238 L146,150 h30 z" fill="#d94f3d" />
        <line x1="200" y1="160" x2="200" y2="238" stroke="#14503c" strokeWidth="6" />
        <line x1="178" y1="162" x2="164" y2="238" stroke="#14503c" strokeWidth="5" />
        <line x1="222" y1="162" x2="236" y2="238" stroke="#14503c" strokeWidth="5" />
        {[
          { x: 200, y: 108, r: 26, c: "#d92b6b", cc: "#f2b544" },
          { x: 162, y: 126, r: 20, c: "#f2604c", cc: "#fbf7ee" },
          { x: 238, y: 126, r: 20, c: "#fbf7ee", cc: "#d92b6b" },
        ].map((f, i) => (
          <g key={i}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse
                key={a} cx={f.x} cy={f.y} rx="11" ry="20" fill={f.c}
                transform={`rotate(${a} ${f.x} ${f.y})`} opacity="0.92"
              />
            ))}
            <circle cx={f.x} cy={f.y} r="9" fill={f.cc} />
          </g>
        ))}
        <ellipse cx="150" cy="200" rx="14" ry="7" fill="#2e9e63" transform="rotate(-30 150 200)" />
        <ellipse cx="250" cy="200" rx="14" ry="7" fill="#2e9e63" transform="rotate(30 250 200)" />
      </>
    ),
  },
  gift: {
    bg: ["#e6dcf9", "#a582e0"],
    body: (
      <>
        <Shadow />
        {[70, 120].map((x) => (
          <g key={x} transform={`translate(${x},60)`}>
            <circle cx="0" cy="0" r="4" fill="#fbf7ee" />
            <circle cx="26" cy="14" r="3" fill="#f2b544" />
            <circle cx="-24" cy="18" r="3.5" fill="#f2604c" />
          </g>
        ))}
        <rect x="128" y="140" width="144" height="100" rx="12" fill="#5b2b8e" />
        <rect x="118" y="112" width="164" height="36" rx="10" fill="#6d3aa5" />
        <rect x="188" y="112" width="24" height="128" fill="#f2b544" />
        <path d="M200,112 c-22,-30 -62,-26 -58,-2 c3,18 34,14 58,2 z" fill="#f2b544" />
        <path d="M200,112 c22,-30 62,-26 58,-2 c-3,18 -34,14 -58,2 z" fill="#e09a2b" />
        <circle cx="200" cy="110" r="9" fill="#d94f3d" />
        <circle cx="150" cy="190" r="5" fill="#ffffff" opacity="0.5" />
        <circle cx="246" cy="206" r="6" fill="#ffffff" opacity="0.5" />
      </>
    ),
  },
  fish: {
    bg: ["#d5edf6", "#5cb8d8"],
    body: (
      <>
        <path d="M0,228 q40,-14 80,0 t80,0 t80,0 t80,0 t80,0" stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.6" />
        <path d="M0,248 q40,-14 80,0 t80,0 t80,0 t80,0 t80,0" stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.4" />
        <Shadow />
        <path d="M268,160 l56,-34 v68 z" fill="#f2604c" />
        <ellipse cx="190" cy="160" rx="86" ry="52" fill="#2e9ec2" />
        <ellipse cx="190" cy="176" rx="66" ry="30" fill="#7cc7e2" opacity="0.7" />
        <path d="M150,120 q30,-26 70,-28 l-8,22 q-30,2 -52,20 z" fill="#134e6f" />
        <circle cx="132" cy="150" r="13" fill="#ffffff" />
        <circle cx="130" cy="150" r="6" fill="#0b2b21" />
        <path d="M196,132 q14,28 0,56" stroke="#134e6f" strokeWidth="5" fill="none" opacity="0.7" />
        <circle cx="110" cy="100" r="6" fill="#ffffff" opacity="0.8" />
        <circle cx="128" cy="76" r="4.5" fill="#ffffff" opacity="0.8" />
        <circle cx="96" cy="66" r="3.5" fill="#ffffff" opacity="0.8" />
      </>
    ),
  },
  fruit: {
    bg: ["#fbefd8", "#f0b95c"],
    body: (
      <>
        <Shadow />
        <ellipse cx="200" cy="222" rx="86" ry="20" fill="#8a5a24" opacity="0.35" />
        <circle cx="160" cy="196" r="34" fill="#f2b544" />
        <circle cx="240" cy="196" r="34" fill="#f2604c" />
        <circle cx="200" cy="170" r="34" fill="#e07f2b" />
        <path d="M200,136 c0,-10 4,-14 10,-18" stroke="#5b3a12" strokeWidth="6" fill="none" strokeLinecap="round" />
        <ellipse cx="220" cy="132" rx="14" ry="8" fill="#2e9e63" transform="rotate(-18 220 132)" />
        <ellipse cx="150" cy="162" rx="14" ry="7" fill="#2e9e63" transform="rotate(-24 150 162)" />
        <circle cx="150" cy="188" r="5" fill="#d9942b" />
        <circle cx="250" cy="188" r="5" fill="#d94f3d" />
        <path d="M132,216 q68,22 136,0" stroke="#8a5a24" strokeWidth="8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  meal: {
    bg: ["#0e3a2c", "#1b6a4f"],
    body: (
      <>
        <ellipse cx="200" cy="228" rx="120" ry="14" fill="#000000" opacity="0.25" />
        <Steam x={200} color="#fbf7ee" />
        <path d="M110,210 a90,86 0 0 1 180,0 z" fill="#fbf7ee" />
        <rect x="96" y="206" width="208" height="14" rx="7" fill="#f2b544" />
        <circle cx="200" cy="112" r="10" fill="#f2604c" />
        <rect x="120" y="230" width="160" height="10" rx="5" fill="#f2b544" opacity="0.7" />
        <circle cx="96" cy="90" r="4" fill="#f2b544" />
        <circle cx="304" cy="120" r="5" fill="#f2604c" />
        <circle cx="290" cy="70" r="3.5" fill="#fbf7ee" />
      </>
    ),
  },
};

import { useId } from "react";

export function Art({ hint, label, className = "h-28" }: { hint: string; label: string; className?: string }) {
  const scene = SCENES[hint] ?? SCENES.meal;
  const key = hint in SCENES ? hint : "meal";
  // Unique gradient id per instance — the same hint renders many times per page.
  const gid = `g-${key}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const decorative = !label;
  const widthCls = /\bw-\S+/.test(className) ? "" : "w-full";
  return (
    <div className={`${className} ${widthCls} relative overflow-hidden`} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={scene.bg[0]} />
            <stop offset="100%" stopColor={scene.bg[1]} />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#${gid})`} />
        {scene.body}
      </svg>
      {/* Sample badge — real partner photos replace these at onboarding. */}
      <span className="absolute bottom-1.5 left-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Demo photo
      </span>
    </div>
  );
}
