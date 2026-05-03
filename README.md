# WhatsApp Bot - Mr_Gamiya (v2.0)

අලුත්ම WhatsApp Status Like (Heart) පහසුකම සහ තවත් බොහෝ දේ ඇතුළත් සරල සහ බලවත් WhatsApp බොට් කෙනෙකි.

---

## ප්‍රධාන විශේෂාංග (Features)

- **Auto Status View:** ඔබගේ මිතුරන් දමන සියලුම Statuses ස්වයංක්‍රීයව නරඹයි (Mark as Seen).
- **Anti-Badword System:** ගෲප් එකක අසභ්‍ය වචන භාවිත කරන සාමාජිකයන්ගේ පණිවිඩ මකා දමා ඔවුන්ට අනතුරු ඇඟවීම් සිදු කරයි.
- **Group Management:** ගෲප් වලට සාමාජිකයන් එකතු කිරීම (.add), ඉවත් කිරීම (.remove), සහ Admin තනතුරු ලබා දීම (.promote/.demote) බොට් හරහා කළ හැක.
- **External Configuration:** බොට්ගේ සියලුම සැකසුම් (Owners/Badwords) බොට් ක්‍රියාත්මක වන අතරතුර පවා `config.json` මගින් පහසුවෙන් වෙනස් කළ හැක.

---

## විධාන (Commands)

### පොදු විධාන (Public Commands)
- `/ping` - බොට්ගේ වේගය පරීක්ෂා කිරීමට.
- `/help` - සියලුම විධාන ලැයිස්තුව ලබා ගැනීමට.

### හිමිකරු විධාන (Owner Commands)
- `/add <number>` - සාමාජිකයෙකු එක් කිරීමට. (උදා: `.add 94722xxxxxx`)
- `/remove <tag/number>` - සාමාජිකයෙකු ඉවත් කිරීමට.
- `/promote <tag/number>` - Admin තනතුර ලබා දීමට.
- `/demote <tag/number>` - Admin තනතුර ඉවත් කිරීමට.

---

## Configuration (සැකසුම් සකස් කිරීම)

දැන් ඔබට `index.js` වෙනස් කිරීමට අවශ්‍ය නැත. සියල්ල `config.json` මගින් කළ හැක:

```json
{
    "owners": ["94722xxxxxx@s.whatsapp.net"],
    "badwords": ["word1", "word2"]
}
```

---

## Linux VPS Setup (Ubuntu/Debian)

ඔබගේ Linux VPS එකට බොට් ඇතුළත් කිරීමට පහත පියවර අනුගමනය කරන්න.

### 1. අවසාදිත මෘදුකාංග ස්ථාපනය (System Update & Dependencies)
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

### 2. බොට් ඩවුන්ලෝඩ් කර ගැනීම (Clone Project)
```bash
git clone https://github.com/gamitha-999/Whatsapp-BOT.git
cd Whatsapp-BOT
```

### 3. අවශ්‍ය Module ස්ථාපනය (Install Modules)
```bash
npm install @whiskeysockets/baileys pino qrcode-terminal @hapi/boom
```

### 4. බොට් ක්‍රියාත්මක කිරීම (Run Bot)
පළමු වරට බොට් ක්‍රියාත්මක කර QR Code එක ස්කෑන් කරන්න:
```bash
node index.js
```

### 5. 24/7 ක්‍රියාත්මක කර තැබීම (Using PM2)
බොට් එක නතර නොවී දිගටම වැඩ කිරීමට PM2 පාවිච්චි කරන්න:
```bash
sudo npm install -g pm2
pm2 start index.js --name "gamiya-bot"
pm2 save
pm2 startup
```

---

## වැදගත් (Important)

- **Ghost Status Fix:** මෙම බොට් එකේ Reaction එක යන්නේ Status එක දාපු කෙනාට පණිවිඩයක් ලෙස නොව, සැබෑ "Like" එකක් ලෙස බැවින් ඔබේ පැත්තෙන් Ghost status හැදෙන්නේ නැත.
- **Privacy:** `config.json` එකට ඔබේ අංකය ඇතුළත් කරන විට `947... @s.whatsapp.net` ආකාරයට ඇතුළත් කරන්න.

> Created❤️ by Mr_Gamiya
