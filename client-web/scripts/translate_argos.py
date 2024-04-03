import json
import sys
from argostranslate import translate

for line in sys.stdin:
    task = json.loads(line)
    srclang = task["source"]
    dstlang = task["target"]

    installed_languages = { lang.code: lang for lang in translate.load_installed_languages() }
    if srclang not in installed_languages:
        raise Exception(f"need language {srclang}")
    if dstlang not in installed_languages:
        raise Exception(f"need language {dstlang}")
    srclang = installed_languages[srclang]
    dstlang = installed_languages[dstlang]
    translator = srclang.get_translation(dstlang)
    if translator is None:
        raise Exception("no translator available")


    def tr(key, ob):
        if ob == None: return None
        if isinstance(ob, list): return [ tr(None,e) for e in ob ]
        if isinstance(ob, dict): return { k: tr(k,v) for k, v in ob.items() }
        if isinstance(ob, str): 
            print(f"{srclang.code}->{dstlang.code} {key}", file=sys.stderr)
            return translator.translate(ob)

    print(json.dumps(tr("root", task["strings"])))

