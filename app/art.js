// オリジナルSVGイラスト（viewBox 0 0 100 100）
const _S='stroke="#151515" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const _sp=(x,y,r,f='#fff')=>`<path d="M${x} ${y-r} L${x+r*.3} ${y-r*.3} L${x+r} ${y} L${x+r*.3} ${y+r*.3} L${x} ${y+r} L${x-r*.3} ${y+r*.3} L${x-r} ${y} L${x-r*.3} ${y-r*.3}Z" fill="${f}" ${_S} stroke-width="1.6"/>`;
const _eye=(x,y,r=6)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${_S}/><circle cx="${x+1}" cy="${y+1}" r="${r*.45}" fill="#151515"/><circle cx="${x+2}" cy="${y-1}" r="${r*.15}" fill="#fff"/>`;
const ART=[
// 0 はらぺこバハムート
`<circle cx="50" cy="52" r="44" fill="#ff9eb5"/>${_sp(14,20,6,'#ffd23f')}${_sp(88,78,5,'#ffd23f')}
<path d="M30 30 L20 10 L40 25Z" fill="#fff3c4" ${_S}/><path d="M70 30 L80 10 L60 25Z" fill="#fff3c4" ${_S}/>
<path d="M16 60 Q50 50 84 60 Q80 94 50 94 Q20 94 16 60Z" fill="#b0124f" ${_S}/>
<path d="M37 84 Q50 72 63 84 Q50 92 37 84Z" fill="#ff6f91" ${_S}/>
<path d="M14 54 Q12 22 50 20 Q88 22 86 54 L86 60 Q50 48 14 60Z" fill="#7b4dff" ${_S}/>
<path d="M26 57 L31 67 L35 55Z M43 53 L48 64 L53 53Z M61 55 L66 67 L71 57Z" fill="#fff" ${_S} stroke-width="1.8"/>
<path d="M30 90 L35 82 L40 91Z M60 91 L65 82 L70 90Z" fill="#fff" ${_S} stroke-width="1.8"/>
${_eye(36,36,7)}${_eye(64,36,7)}<path d="M28 27 L42 31 M72 27 L58 31" ${_S}/>
<path d="M80 66 q4 9 0 14 q-4 -5 0 -14z" fill="#8fd3ff" ${_S} stroke-width="1.8"/>`,
// 1 こどもバハムート
`<circle cx="50" cy="52" r="44" fill="#fff0a8"/>${_sp(18,22,5)}${_sp(84,30,4)}
<path d="M24 46 Q12 36 14 54 Q20 52 26 56Z" fill="#c9b5ff" ${_S}/><path d="M76 46 Q88 36 86 54 Q80 52 74 56Z" fill="#c9b5ff" ${_S}/>
<path d="M38 30 L34 18 L44 27Z M62 30 L66 18 L56 27Z" fill="#fff3c4" ${_S}/>
<circle cx="50" cy="48" r="24" fill="#9c7bff" ${_S}/>
${_eye(41,44,6)}${_eye(59,44,6)}<ellipse cx="35" cy="54" rx="4" ry="2.5" fill="#ff8fab"/><ellipse cx="65" cy="54" rx="4" ry="2.5" fill="#ff8fab"/>
<path d="M45 56 Q50 61 55 56" fill="none" ${_S}/>
<path d="M22 66 L29 58 L35 66 L42 58 L50 66 L58 58 L65 66 L71 58 L78 66 Q78 92 50 92 Q22 92 22 66Z" fill="#fff" ${_S}/>
<path d="M34 80 q4 -3 8 0 M58 76 q4 -3 8 0" fill="none" ${_S} stroke-width="1.6" opacity=".5"/>`,
// 2 はねかえしゴブリン
`<circle cx="50" cy="52" r="44" fill="#d4f5c4"/>
<path d="M16 34 L28 42 L24 52Z M64 34 L52 42 L56 52Z" fill="#5fc441" ${_S}/>
<ellipse cx="40" cy="48" rx="17" ry="18" fill="#7ed957" ${_S}/>
${_eye(34,44,5)}${_eye(47,44,5)}<path d="M31 56 Q40 64 49 56 L46 59 L43 56 L40 60 L37 56 L34 59Z" fill="#fff" ${_S} stroke-width="1.8"/>
<path d="M30 66 Q40 74 50 66 L52 88 L28 88Z" fill="#8d6e63" ${_S}/>
<circle cx="66" cy="60" r="22" fill="#ffd23f" ${_S}/><circle cx="66" cy="60" r="14" fill="#ffb300" ${_S}/>
<path d="M56 68 Q64 44 76 62" fill="none" ${_S} stroke-width="3.2"/><path d="M71 62 L77 63 L78 56" fill="none" ${_S} stroke-width="3.2"/>
${_sp(88,30,5,'#ff4d4d')}`,
// 3 イデヨン！
`<circle cx="50" cy="52" r="44" fill="#d6f0ff"/>
<ellipse cx="50" cy="74" rx="38" ry="13" fill="#8fd3ff" ${_S}/><ellipse cx="50" cy="74" rx="27" ry="8.5" fill="none" ${_S} stroke-dasharray="4 4"/>
<path d="M50 66 L53 72 L60 73 L55 77 L56 83 L50 80 L44 83 L45 77 L40 73 L47 72Z" fill="#ffd23f" ${_S} stroke-width="1.6"/>
<path d="M50 60 V18 M38 30 L50 16 L62 30" fill="none" ${_S} stroke-width="5"/><path d="M50 60 V18 M38 30 L50 16 L62 30" fill="none" stroke="#ffd23f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
${_sp(24,36,7,'#fff')}${_sp(78,40,6,'#ffd23f')}${_sp(70,18,4)}`,
// 4 ヨミガエール！
`<circle cx="50" cy="52" r="44" fill="#e3dcff"/>
<path d="M10 86 Q50 78 90 86 L90 94 L10 94Z" fill="#8d6e63" ${_S}/>
<path d="M30 86 V46 Q30 28 50 28 Q70 28 70 46 V86Z" fill="#cfd8dc" ${_S}/>
<path d="M50 40 V64 M42 48 H58" ${_S} stroke-width="3.2"/>
<path d="M74 64 Q64 50 74 38 Q84 26 76 14" fill="none" ${_S} stroke-dasharray="1 6" stroke-width="3.5"/>
<path d="M70 18 L76 10 L82 18" fill="none" ${_S}/>
${_sp(20,30,6,'#fff')}${_sp(86,52,5,'#ffd23f')}`,
// 5 イレカエール！
`<circle cx="50" cy="52" r="44" fill="#d6f0ff"/>
<path d="M22 44 A30 30 0 0 1 74 30" fill="none" ${_S} stroke-width="4"/><path d="M66 24 L76 30 L68 40" fill="none" ${_S} stroke-width="4"/>
<path d="M78 60 A30 30 0 0 1 26 74" fill="none" ${_S} stroke-width="4"/><path d="M34 80 L24 74 L32 64" fill="none" ${_S} stroke-width="4"/>
<circle cx="30" cy="58" r="10" fill="#9c7bff" ${_S}/>${_eye(27,56,2.6)}${_eye(33,56,2.6)}
<circle cx="68" cy="48" r="15" fill="#7b4dff" ${_S}/><path d="M61 36 L58 28 L65 34Z M75 36 L78 28 L71 34Z" fill="#fff3c4" ${_S} stroke-width="1.6"/>${_eye(63,46,3.4)}${_eye(73,46,3.4)}<path d="M62 54 Q68 60 74 54Z" fill="#b0124f" ${_S} stroke-width="1.6"/>`,
// 6 オワカーレ！
`<circle cx="50" cy="52" r="44" fill="#e8e0ff"/>
<circle cx="56" cy="54" r="30" fill="#3a1f7a" ${_S}/>
<path d="M56 54 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16 a20 20 0 1 1 -20 -20" fill="none" stroke="#b48cff" stroke-width="2.6" stroke-linecap="round"/>
<path d="M14 64 Q12 48 20 40 L24 30 Q27 26 29 31 L28 40 L32 28 Q35 24 37 29 L35 41 L39 32 Q42 28 44 33 L40 48 Q46 44 48 48 Q38 58 34 66 Q26 74 14 64Z" fill="#ffe0c2" ${_S}/>
<path d="M10 28 q-4 4 0 8 M8 20 q-7 8 0 16" fill="none" ${_S} stroke-width="2"/>
${_sp(82,22,6,'#ffd23f')}`,
// 7 そらとぶナイフ
`<circle cx="50" cy="52" r="44" fill="#eeeeee"/>
<path d="M14 30 H34 M10 42 H26 M18 54 H30" ${_S} stroke-width="3"/>
<path d="M44 46 Q30 30 38 22 Q48 30 50 42Z" fill="#fff" ${_S}/><path d="M54 56 Q70 70 78 62 Q70 52 58 50Z" fill="#fff" ${_S}/>
<path d="M30 72 L72 30 L80 26 L76 34 L36 78Z" fill="#e0f2ff" ${_S}/><path d="M38 70 L74 32" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
<path d="M26 68 L40 82 M33 75 L18 90 L14 86 L29 71" fill="#ff6f3c" ${_S}/>
${_sp(84,78,6,'#ff4d4d')}`,
// 8 魔女のおとどけもの
`<circle cx="50" cy="52" r="44" fill="#f1e6ff"/>
<path d="M12 44 Q34 52 56 44 L40 38 L30 8 Q26 22 24 38Z" fill="#7b4dff" ${_S}/><path d="M25 36 Q33 40 40 37 L41 42 Q33 45 24 41Z" fill="#ffd23f" ${_S} stroke-width="1.8"/>
<rect x="44" y="54" width="40" height="32" fill="#ff8fab" ${_S}/><rect x="40" y="46" width="48" height="10" fill="#ff6f91" ${_S}/>
<path d="M64 46 V86" stroke="#ffd23f" stroke-width="6"/><path d="M64 46 V86" fill="none" ${_S} stroke-width="1.4"/>
<path d="M64 46 Q52 32 56 44 Q60 48 64 46 Q76 32 72 44 Q68 48 64 46" fill="#ffd23f" ${_S} stroke-width="1.8"/>
<path d="M20 70 L26 64 L32 70 L26 76Z" fill="#b48cff" ${_S}/>${_sp(86,24,5,'#fff')}`,
// 9 ほしふる砂時計
`<circle cx="50" cy="52" r="44" fill="#2b2f6b"/>
${_sp(18,24,5,'#ffd23f')}${_sp(82,22,7,'#ffd23f')}${_sp(80,72,4,'#fff')}${_sp(20,74,4,'#fff')}
<rect x="28" y="12" width="44" height="8" fill="#c08552" ${_S}/><rect x="28" y="84" width="44" height="8" fill="#c08552" ${_S}/>
<path d="M33 20 H67 Q66 40 52 52 Q66 64 67 84 H33 Q34 64 48 52 Q34 40 33 20Z" fill="#e0f7ff" ${_S}/>
<path d="M38 30 H62 Q58 42 50 48 Q42 42 38 30Z" fill="#ffd23f"/><path d="M38 82 Q50 66 62 82Z" fill="#ffd23f"/><path d="M50 52 V72" stroke="#ffd23f" stroke-width="2" stroke-dasharray="2 3"/>
<path d="M33 20 H67 Q66 40 52 52 Q66 64 67 84 H33 Q34 64 48 52 Q34 40 33 20Z" fill="none" ${_S}/>`,
// 10 カラスのおつかい
`<circle cx="50" cy="52" r="44" fill="#ffe7b8"/>
<path d="M24 40 Q8 30 6 46 Q18 44 28 52Z" fill="#2b2b2b" ${_S}/>
<ellipse cx="48" cy="56" rx="24" ry="18" fill="#2b2b2b" ${_S}/><circle cx="68" cy="38" r="13" fill="#2b2b2b" ${_S}/>
<path d="M79 36 L94 40 L80 44Z" fill="#ffb300" ${_S}/>${_eye(70,35,4)}
<path d="M34 50 Q48 34 58 52 Q46 50 34 50Z" fill="#555" ${_S}/>
<rect x="44" y="70" width="26" height="18" fill="#fff" ${_S} transform="rotate(-8 57 79)"/><path d="M45 72 L57 81 L69 70" fill="none" ${_S} stroke-width="1.8" transform="rotate(-8 57 79)"/>
<path d="M54 72 L52 66 M60 72 L60 66" ${_S} stroke-width="2"/>`,
// 11 銀ネコのしっぽ
`<circle cx="50" cy="52" r="44" fill="#e6eef5"/>
<path d="M26 90 Q22 60 44 52 Q70 44 70 26 Q70 14 58 16" fill="none" stroke="#151515" stroke-width="17" stroke-linecap="round"/>
<path d="M26 90 Q22 60 44 52 Q70 44 70 26 Q70 14 58 16" fill="none" stroke="#c3ced8" stroke-width="11" stroke-linecap="round"/>
<path d="M30 76 L38 72 M34 62 L42 60 M54 48 L60 44 M66 34 L72 32" ${_S} stroke-width="2" opacity=".55"/>
<circle cx="44" cy="54" r="7" fill="#ffd23f" ${_S}/><path d="M41 55 H47 M44 55 V60" ${_S} stroke-width="1.6"/>
${_sp(82,64,6,'#fff')}${_sp(18,30,5,'#fff')}`,
// 12 黒ネコのしっぽ
`<circle cx="50" cy="52" r="44" fill="#d9c9ff"/>
<path d="M30 90 Q30 66 50 58 Q74 50 72 30 Q70 14 54 20 Q46 24 50 30" fill="none" stroke="#151515" stroke-width="17" stroke-linecap="round"/>
<path d="M30 90 Q30 66 50 58 Q74 50 72 30 Q70 14 54 20 Q46 24 50 30" fill="none" stroke="#2b2b2b" stroke-width="11" stroke-linecap="round"/>
<path d="M36 74 Q40 66 48 62" fill="none" stroke="#666" stroke-width="2.5" stroke-linecap="round"/>
<path d="M44 58 Q50 50 58 56 L54 62Z" fill="#ff4d4d" ${_S} stroke-width="1.8"/>
${_sp(18,28,6,'#ffd23f')}${_sp(84,72,5,'#fff')}<path d="M14 54 q6 -2 8 4 M80 18 q6 2 4 8" fill="none" ${_S} stroke-width="2"/>`,
// 13 ひらめき水晶
`<circle cx="50" cy="52" r="44" fill="#fff6c9"/>
<path d="M28 82 L72 82 L66 92 L34 92Z" fill="#8d6e63" ${_S}/>
<circle cx="50" cy="52" r="28" fill="#b3e5ff" ${_S}/><path d="M34 44 Q38 32 50 30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
<path d="M50 40 Q60 40 60 50 Q60 56 55 60 V64 H45 V60 Q40 56 40 50 Q40 40 50 40Z" fill="#ffd23f" ${_S} stroke-width="2"/><path d="M45 67 H55" ${_S} stroke-width="2"/>
<path d="M50 14 V6 M76 24 L82 18 M24 24 L18 18 M86 46 H94 M14 46 H6" ${_S} stroke-width="3"/>`,
// 14 ようせいのメガネ
`<circle cx="50" cy="52" r="44" fill="#dff7e8"/>
<path d="M18 40 Q4 20 14 14 Q26 14 28 36Z M82 40 Q96 20 86 14 Q74 14 72 36Z" fill="#fff" ${_S} opacity=".95"/>
<path d="M20 46 Q8 52 12 64 Q22 62 26 52Z M80 46 Q92 52 88 64 Q78 62 74 52Z" fill="#e8fff3" ${_S}/>
<circle cx="34" cy="52" r="15" fill="#d6f0ff" ${_S} stroke-width="4"/><circle cx="66" cy="52" r="15" fill="#d6f0ff" ${_S} stroke-width="4"/>
<path d="M49 50 Q50 46 51 50" fill="none" ${_S} stroke-width="3"/>
<path d="M26 46 L32 42 M58 46 L64 42" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
${_sp(50,22,6,'#ffd23f')}${_sp(30,82,4,'#ffd23f')}${_sp(72,82,5,'#fff')}`,
// 15 あくまの吹き矢
`<circle cx="50" cy="52" r="44" fill="#ffd6d6"/>
<path d="M14 82 L54 46" stroke="#151515" stroke-width="11" stroke-linecap="round"/><path d="M14 82 L54 46" stroke="#8d6e63" stroke-width="6" stroke-linecap="round"/>
<path d="M66 38 L84 22" ${_S} stroke-width="3"/><path d="M84 22 L80 30 L88 26Z" fill="#151515" ${_S} stroke-width="1.6"/>
<path d="M62 42 L56 40 L60 46Z M64 36 L62 30 L68 34Z" fill="#ff4d4d" ${_S} stroke-width="1.6"/>
<path d="M58 34 q-2 -2 -4 0 M52 30 q-2 -2 -4 0" fill="none" ${_S} stroke-width="1.6" opacity=".6"/>
<path d="M22 30 L18 14 L30 24Z M42 30 L46 14 L34 24Z" fill="#c62828" ${_S}/>
<path d="M70 70 Q84 66 80 82 Q78 88 86 88" fill="none" ${_S} stroke-width="3"/><path d="M86 84 L92 90 L84 92Z" fill="#c62828" ${_S} stroke-width="1.6"/>`,
];
const artSVG=c=>`<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${ART[c]}</svg>`;
