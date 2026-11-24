// ===== オンライン対戦の通信設定 =====
// Firebase Realtime Database を使うときは、Firebase コンソールの
// 「プロジェクトの設定 → マイアプリ → SDK の設定と構成（構成）」の値をここに書く。
// null のままなら PeerJS（WebRTC）でつなぐ。手順は docs/ONLINE.md。
// 例:
// const FIREBASE_CONFIG={
//   apiKey:'AIza...',
//   authDomain:'xxxx.firebaseapp.com',
//   databaseURL:'https://xxxx-default-rtdb.asia-southeast1.firebasedatabase.app',
//   projectId:'xxxx',
//   appId:'1:...:web:...',
// };
const FIREBASE_CONFIG=null;

// ===== PeerJS（WebRTC）用の STUN / TURN =====
// モバイル回線同士など、直接つながれないときは TURN（中継サーバー）を経由する（Metered の TURN）。
// ここの値はページに埋め込まれ、誰でも見られる。使われすぎが心配なら Metered の管理画面で鍵を作り直し、ここを書き換える。
const ICE_SERVERS=[
  {urls:'stun:stun.relay.metered.ca:80'},
  {urls:'turn:global.relay.metered.ca:80',username:'f1390d8716af593990d26e83',credential:'l29BSZ66vVBnJD4F'},
  {urls:'turn:global.relay.metered.ca:80?transport=tcp',username:'f1390d8716af593990d26e83',credential:'l29BSZ66vVBnJD4F'},
  {urls:'turn:global.relay.metered.ca:443',username:'f1390d8716af593990d26e83',credential:'l29BSZ66vVBnJD4F'},
  {urls:'turns:global.relay.metered.ca:443?transport=tcp',username:'f1390d8716af593990d26e83',credential:'l29BSZ66vVBnJD4F'},
];
