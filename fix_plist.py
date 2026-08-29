import re

with open('ios/App/App/Info.plist', 'r', encoding='utf-8') as f:
    content = f.read()

if 'NSAppTransportSecurity' not in content:
    content = content.replace('</dict>\n</plist>', '    <key>NSAppTransportSecurity</key>\n    <dict>\n        <key>NSAllowsArbitraryLoads</key>\n        <true/>\n    </dict>\n</dict>\n</plist>')

with open('ios/App/App/Info.plist', 'w', encoding='utf-8') as f:
    f.write(content)
