"""ui.html に各部品を埋め込んで、1ファイルのページを作る。
使い方: python app/build.py [出力先=site/index.html]"""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(D, n), encoding='utf-8').read()
c2 = rd('cpu2.js'); i = c2.find("if(typeof module!=='undefined')"); c2 = c2[:i] if i >= 0 else c2
h = (rd('ui.html').replace('/*ENGINE*/', rd('engine.js')).replace('/*CPU2*/', c2)
     .replace('/*RL*/', rd('rl.js') + rd('weights/rl_weights5.js') + rd('weights/rl_weights6.js') + rd('weights/rl_weights65.js'))
     .replace('/*RULES*/', rd('rules.js')).replace('/*ART*/', rd('art.js'))
     .replace('/*ONLINE*/', rd('online_config.js') + rd('online.js')))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, '..', 'site', 'index.html')
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(h); print(out, len(h) // 1024, 'KB')
