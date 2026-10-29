#!/bin/bash
# err.day print helper installer (macOS).
#   curl -fsSL https://book.err-daysalon.com/print-agent/install.sh | bash -s -- <KEY> <PRINTER_IP>
set -e
KEY="$1"; PRINTER_IP="$2"; BASE="${3:-https://book.err-daysalon.com}"
if [ -z "$KEY" ] || [ -z "$PRINTER_IP" ]; then echo "ใช้: install.sh <รหัสเครื่องพิมพ์> <IP เครื่องพิมพ์>"; exit 1; fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "ยังไม่มี Node.js — ติดตั้งจาก https://nodejs.org (เลือก LTS) แล้วรันคำสั่งนี้อีกครั้ง"; exit 1
fi
echo "ใช้ Node: $NODE ($("$NODE" -v))"

DIR="$HOME/.errday-print"
mkdir -p "$DIR" "$HOME/Library/LaunchAgents"
curl -fsSL "$BASE/print-agent/errday-print-agent.mjs" -o "$DIR/errday-print-agent.mjs"

echo "ตรวจการเชื่อมต่อเครื่องพิมพ์ $PRINTER_IP ..."
if nc -z -G 3 "$PRINTER_IP" 9100 2>/dev/null; then echo "  ✓ เครื่องพิมพ์ตอบสนอง"; else
  echo "  ✗ ติดต่อ $PRINTER_IP:9100 ไม่ได้ — ตรวจ IP เครื่องพิมพ์ และว่าอยู่ WiFi เดียวกับเครื่องนี้ (ติดตั้งต่อให้ แต่จะพิมพ์ไม่ออกจนกว่าจะต่อได้)"
fi

PLIST="$HOME/Library/LaunchAgents/com.errday.printagent.plist"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.errday.printagent</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/caffeinate</string><string>-i</string>
    <string>$NODE</string><string>$DIR/errday-print-agent.mjs</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>ERRDAY_KEY</key><string>$KEY</string>
    <key>PRINTER_HOST</key><string>$PRINTER_IP</string>
    <key>ERRDAY_URL</key><string>$BASE</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/agent.log</string>
  <key>StandardErrorPath</key><string>$DIR/agent.log</string>
</dict></plist>
PLISTEOF
chmod 600 "$PLIST"

launchctl bootout "gui/$(id -u)/com.errday.printagent" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 3
echo; echo "ติดตั้งเสร็จแล้ว — โปรแกรมจะเปิดเองทุกครั้งที่เปิดเครื่อง"
echo "บันทึกการทำงาน: $DIR/agent.log"; tail -n 5 "$DIR/agent.log" 2>/dev/null || true
