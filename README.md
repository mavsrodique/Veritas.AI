# Look Within: Bulletin Board Companion Site
St. Thomas of Villanova: Model of Augustinian Interiority in the Age of AI.
Flask + Ollama, fully offline after setup.

## 1. Install Python dependencies
Install Python 3.10+ (python.org; tick "Add to PATH" on Windows). In this folder:
```
python -m venv venv
venv\Scripts\activate          (Windows)   |   source venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt
```

## 2. Install Ollama
Download from https://ollama.com/download and install. It runs in the background (port 11434).

## 3. Download the model (do this while online)
```
ollama pull gemma3:4b
```
Lighter alternative for slower laptops: `ollama pull qwen2.5:3b`, then set the model:
Windows `set VERITAS_MODEL=qwen2.5:3b`, Mac/Linux `export VERITAS_MODEL=qwen2.5:3b`.
Test: `ollama run gemma3:4b "Hello"`. Then do one test run before the event so the model is cached.

## 4. Run Flask
```
python app.py
```
Open http://localhost:5000 on the laptop to check it. The site works without Ollama; only Veritas AI needs it.

## 5. Find the laptop's IP address
Windows: `ipconfig` -> "IPv4 Address". Mac: `ipconfig getifaddr en0`. Linux: `hostname -I`.
Do this AFTER the hotspot is on (step 6). Windows hotspots are usually 192.168.137.1.

## 6. Create the hotspot
- Windows 10/11: Settings > Network & Internet > Mobile hotspot > On. Set a name and password.
  (It shares an existing connection; if the laptop is offline, use a Wi-Fi/Ethernet link or a phone's USB tether, or create it with a loopback adapter. Test first.)
- macOS: System Settings > General > Sharing > Internet Sharing (share from Ethernet/Thunderbolt to Wi-Fi).
- Windows firewall: allow Python on private networks when prompted, or run
  `netsh advfirewall firewall add rule name="Flask5000" dir=in action=allow protocol=TCP localport=5000`.

## 7. Generate the QR code
```
python qr.py http://192.168.137.1:5000
```
Replace the address with yours. Print qr.png on the board. Visitors must join the hotspot first, so also print the hotspot name and password beside the QR (or use a Wi-Fi QR from any generator).

## 8. Access from phones
Connect the phone to the laptop's hotspot, scan the QR code, and the site opens. If it doesn't, check the IP, the firewall, and that the phone didn't switch back to mobile data.

## 9. Test Veritas AI
Open the Veritas AI page. The status line should say "Veritas is awake." Try "What does look within mean?". The first answer may take 10 to 30 seconds while the model loads. Check http://<ip>:5000/api/health if there's a problem.

## Event-day checklist
Charge the laptop and keep it plugged in. Run `ollama serve` if needed. Disable sleep mode. Test from two phones.

---
## Redesign notes (current version)

**Visitor journey (all original routes kept):**
`/` Look Within > `/about` > `/thomas` > `/interiority` > `/symbolism` > `/reflections` > `/artificial-intelligence` > `/ai` (Veritas, last).
The feather questions are intentionally NOT on the site. The only board text reused is the question on the amber tag, on the Veritas page (delete the `<blockquote class="board-q">` in `templates/ai.html` to remove it).

**Knowledge base (`knowledge/`):** `thomas.txt`, `interiority.txt`, `symbolism.txt`, `ethics.txt`.
I wrote starter versions from well-established facts. REPLACE THEM WITH YOUR OWN FILES (same names; keep each under ~1,800 characters).
Veritas reads them on every question (edits apply without restarting), puts the most relevant file first, and is told not to invent facts beyond them.
Check `http://<ip>:5000/api/health` to confirm all four files are loaded.

**Streaming:** `/api/chat/stream` sends words as they are written (the first word appears much sooner on a laptop). `/api/chat` still works as before and is used as a fallback.

**Model:** default `gemma3:4b`. Lighter: `set VERITAS_MODEL=qwen2.5:3b` (Windows) or `export VERITAS_MODEL=qwen2.5:3b`.

**Tuning:** Veritas' voice lives in `PERSONA` in `app.py`. Colors and type live in the `:root` block at the top of `static/style.css`. All page text is in `templates/*.html`.
