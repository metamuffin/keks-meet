import json
import sys
from argostranslate import translate

srclang = "en"
dstlang = sys.argv[1]

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


print(json.loads("".join(sys.stdin)))

print(translator.translate("Hello world"))
