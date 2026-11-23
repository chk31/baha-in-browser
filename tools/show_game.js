// 使い方: node show_game.js games_ai6.jsonl.gz <seed>   … その局を、ライフ・書・手札つきで表示
const fs=require('fs'),zlib=require('zlib');
const [F,SEED]=[process.argv[2],+process.argv[3]];
const L=zlib.gunzipSync(fs.readFileSync(F)).toString().split('\n').filter(Boolean);
const H=JSON.parse(L[0]);const N=c=>H.cards[c];const P=p=>p===g.first?'先攻':'後攻';
const g=L.slice(1).map(JSON.parse).find(x=>x.seed===SEED);if(!g){console.log('なし');process.exit();}
const sh=st=>`ライフ 先${st.life[g.first]}-後${st.life[1-g.first]}｜書 先${st.chips[g.first]}-後${st.chips[1-g.first]}`;
const hd=(st,p)=>st.hand[p].map(N).join('、')||'なし';
console.log(`seed ${g.seed}　勝者：${P(g.winner)}`);
for(const e of g.ev){switch(e.k){
 case 'start':console.log(`先攻の初手：${e.hands[g.first].map(N).join('、')}\n後攻の初手：${e.hands[1-g.first].map(N).join('、')}`);break;
 case 'turn':console.log(`\n── ターン${e.t}（${P(e.p)}）  ${sh(e.st)}`);console.log(`   手札 先：${hd(e.st,g.first)}／後：${hd(e.st,1-g.first)}`);break;
 case 'attack':console.log(`  ${N(e.src)}の攻撃`);break;
 case 'damage':console.log(`  ${e.refl?'ゴブリンが跳ね返し→':''}${P(e.to)}に${e.amt}ダメージ（残り${e.life}）`);break;
 case 'draw':if(e.cards.length)console.log(`  ${P(e.who)}が引いた：${e.cards.map(N).join('、')}`);break;
 case 'play':console.log(`  ${P(e.who)}が「${N(e.card)}」をプレイ`);break;
 case 'negate':console.log(`    → ${P(e.who)}がうちけし（書 先${e.chips[g.first]}-後${e.chips[1-g.first]}）`);break;
 case 'counter':console.log(`    → ${P(e.who)}がうちけし返し（書 先${e.chips[g.first]}-後${e.chips[1-g.first]}）`);break;
 case 'resolved':if(!e.ok)console.log(`    → 無効`);break;
 case 'enter':console.log(`    → ${N(e.card)}が${P(e.who)}の場に出た`);break;
 case 'leave':console.log(`    → ${P(e.owner)}の${N(e.card)}が捨て札へ`);break;
 case 'gainChip':console.log(`    → 書+1（${P(e.who)}は${e.chips}枚）`);break;
 case 'recover':console.log(`    → 捨て札から${N(e.card)}を回収（相手に公開）`);break;
 case 'search':console.log(`    → 山札から${N(e.card)}を取った`);break;
 case 'declare':console.log(`    → ${N(e.card)}を宣言：${e.hit?'的中':'はずれ'}`);break;
 case 'snipe':console.log(`    → 相手の手札（${e.seen.map(N).join('、')}）から${N(e.card)}を捨てさせた`);break;
 case 'discard':console.log(`  ${P(e.who)}が捨てた：${e.cards.map(N).join('、')}${e.why==='limit'?'（手札上限）':''}`);break;
 case 'irekae':console.log(`    → 入れ替え${e.ok?'':'失敗'}`);break;
 case 'fizzle':console.log(`    → 効果なし`);break;
 case 'reshuffle':console.log(`  山札切れ→捨て札${e.n}枚を混ぜた`);break;
 case 'end':console.log(`\n${P(e.winner)}の勝ち　${sh(e.st)}`);break;}}
