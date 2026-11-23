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
