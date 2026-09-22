#!/bin/bash
# 뱃일 — 아이폰 빌드 전에 맞출 것 (6.0). ios-e2e.yml · ios-release.yml 둘 다 부른다.
set -e -o pipefail
cd "$(dirname "$0")/../.."
GS=ios/App/App/GoogleService-Info.plist
INFO=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy

# ① 구글 로그인 — GoogleService-Info.plist 에 CLIENT_ID·REVERSED_CLIENT_ID 가 있어야 하고,
#    REVERSED_CLIENT_ID 를 앱의 주소(URL scheme)로 등록해야 구글이 로그인 뒤 앱으로 돌려보낸다.
#    이것이 없으면 GoogleSignIn 이 「URL scheme 이 없다」며 앱을 죽인다.
[ -f "$GS" ] || { echo "::error::$GS 가 없습니다."; exit 1; }
CID=$($PB -c "Print :CLIENT_ID" "$GS" 2>/dev/null || true)
REV=$($PB -c "Print :REVERSED_CLIENT_ID" "$GS" 2>/dev/null || true)
if [ -z "$CID" ] || [ -z "$REV" ]; then
  echo "::error::GoogleService-Info.plist 에 CLIENT_ID/REVERSED_CLIENT_ID 가 없습니다. 파이어베이스 콘솔에서 구글 로그인을 켠 뒤 받은 새 파일이어야 합니다."
  exit 1
fi
$PB -c "Delete :CFBundleURLTypes" "$INFO" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes array" "$INFO"
$PB -c "Add :CFBundleURLTypes:0 dict" "$INFO"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLName string google" "$INFO"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$INFO"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $REV" "$INFO"
plutil -lint "$INFO"
echo "구글 로그인 주소 등록: ${REV:0:28}…"

# ② 권한 안내문 네 나라 말(InfoPlist.strings)을 만들고 Xcode 프로젝트에 넣는다
#    글은 ios/App/infoplist_strings.json 한 곳에 둔다(깃허브 웹으로 올릴 때 새 폴더를 못 만들어서).
python3 - <<'PY'
import json, os
d = json.load(open('ios/App/infoplist_strings.json', encoding='utf-8'))
for l, kv in d.items():
    os.makedirs('ios/App/App/%s.lproj' % l, exist_ok=True)
    with open('ios/App/App/%s.lproj/InfoPlist.strings' % l, 'w', encoding='utf-8') as f:
        for k, v in kv.items():
            f.write('"%s" = "%s";\n' % (k, v))
print('InfoPlist.strings', ','.join(d))
PY
for l in ko en ja ru; do plutil -lint "ios/App/App/$l.lproj/InfoPlist.strings"; done
ruby ios/App/prepare_ios.rb

# ③ 앱 안 캐퍼시터 설정에 애플·구글 로그인 부품이 둘 다 켜져 있는가
grep -q '"apple.com"' ios/App/App/capacitor.config.json || { echo "::error::capacitor.config.json 에 apple.com 이 없습니다."; exit 1; }
grep -q '"google.com"' ios/App/App/capacitor.config.json || { echo "::error::capacitor.config.json 에 google.com 이 없습니다."; exit 1; }
grep -q "CapacitorFirebaseAuthentication/Google" ios/App/Podfile || { echo "::error::Podfile 에 구글 로그인 부품 줄이 없습니다."; exit 1; }
echo "아이폰 설정 맞춤 끝"
