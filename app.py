"""Digital companion to the bulletin board:
St. Thomas of Villanova - Model of Augustinian Interiority in the Age of AI.
Run:  python app.py   (then open http://<laptop-ip>:5000 on a phone)
"""
import json
import os
import re
from pathlib import Path

import requests
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

app = Flask(__name__)
BASE = Path(__file__).parent

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("VERITAS_MODEL", "qwen2.5:3b")  # or "qwen2.5:3b"
MAX_INPUT = 600
MAX_HISTORY = 6
KB_BUDGET = 7000  # characters of knowledge sent with each question

# ---------------------------------------------------------------- knowledge
KB_FILES = ["thomas", "interiority", "symbolism", "ethics","reflections"]
_kb_cache = {}

def load_kb():
    """Read thomas/interiority/symbolism/ethics/reflections .txt (knowledge/ folder or project root).
    Files are re-read automatically when edited."""
    out = {}
    for name in KB_FILES:
        for p in (BASE / "knowledge" / f"{name}.txt", BASE / f"{name}.txt"):
            if p.exists():
                mtime = p.stat().st_mtime
                cached = _kb_cache.get(name)
                if not cached or cached[0] != mtime:
                    _kb_cache[name] = (mtime, p.read_text(encoding="utf-8", errors="ignore").strip())
                out[name] = _kb_cache[name][1]
                break
    return out

TOPICS = {
    "thomas": ("thomas", "villanova", "poor", "saint", "bishop", "bed"),
    "interiority": ("augustin", "interior", "inward", "within", "truth", "reflect"),
    "symbolism": ("symbol", "pelican", "mirror", "feather", "gear", "halo", "board", "heart", "brain"),
    "ethics": ("ethic", "technolog", "responsib", "dignity", "machine", "algorithm", "wisdom", "compassion"),
}

def knowledge_for(question, budget=KB_BUDGET):
    """Most relevant file first, so small models see the right facts and truncation hits the least relevant."""
    kb = load_kb()
    words = set(re.findall(r"[a-z]{4,}", question.lower()))
    q = question.lower()
    def score(kv):
        overlap = sum(1 for w in words if w in kv[1].lower())
        return -(overlap + 3 * sum(1 for t in TOPICS.get(kv[0], ()) if t in q))
    ranked = sorted(kb.items(), key=score)
    parts, left = [], budget
    for name, text in ranked:
        chunk = text[: max(0, left)]
        if chunk:
            parts.append(f"[{name}]\n{chunk}")
            left -= len(chunk)
    return "\n\n".join(parts)

PERSONA = (
    "You are Veritas AI, an educational companion for a project about St. Thomas of Villanova and "
    "Augustinian Interiority. Your purpose is to help visitors explore themes such as reflection, personal "
    "growth, truth, charity, wisdom, human dignity, ethical technology, and the relationship between humanity "
    "and artificial intelligence. Keep responses concise, thoughtful, educational, and aligned with the "
    "project's themes. Do not present yourself as a replacement for conscience, wisdom, self-reflection, or "
    "spiritual discernment.\n\n"
    "VOICE. You are the voice of a museum exhibit that has learned to speak: calm, warm, wise, scholarly and "
    "human. Wisdom without arrogance. Knowledge without coldness. Reflection without judgment. Compassion "
    "without sentimentality. Speak plainly, as a thoughtful guide would to a student standing at the board. "
    "Write short paragraphs of flowing prose, about 3 to 6 sentences in all. No bullet points, headings, bold "
    "text or emojis. Never begin with 'Certainly', 'Great question' or 'As an AI'. Do not lecture or dump facts.\n\n"
    "TRUTH. For facts about St. Thomas of Villanova, Augustine, interiority and the exhibit's symbols, rely on "
    "the KNOWLEDGE below. Do not invent dates, quotations, miracles, theology or symbolism. If the knowledge "
    "does not cover something, say so gently and honestly, and offer what you do know. You may explain general "
    "ideas about technology and ethics in your own words, but say when you are giving a general view.\n\n"
    "CARE. When natural, end with one short, open question that invites the visitor to reflect for themselves. "
    "Do not tell the visitor what to believe or who to be. If someone shares real distress, respond with "
    "kindness and encourage them to speak with a trusted person such as a parent, teacher or counselor. If "
    "asked about something unrelated to the exhibit, answer briefly if harmless, then gently turn back toward "
    "its themes. You are a program, not a person or a saint; say so plainly if asked, without coldness."
)

# ----------------------------------------------------------------- journey
# (endpoint, title, short nav label, group). Veritas AI is deliberately last.
CHAPTERS = [
    ("index", "Look Within", "Home", "Curiosity"),
    ("about", "The Project", "Project", "Ideas"),
    ("thomas", "St. Thomas of Villanova", "St. Thomas", "Ideas"),
    ("interiority", "Augustinian Interiority", "Interiority", "Ideas"),
    ("symbolism", "The Symbols", "Symbols", "Symbols"),
    ("reflections", "Human Reflection", "Reflection", "Reflection"),
    ("artificial", "Artificial Intelligence", "The Age of AI", "Reflection"),
    ("ai", "Veritas AI", "Veritas AI", "Conversation"),
]
ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"]
PATHS = {"index": "/", "artificial": "/artificial-intelligence"}  # existing routes are unchanged

def make_view(name):
    def view():
        return render_template(f"{name}.html")
    view.__name__ = name
    return view

for _key, *_ in CHAPTERS:
    app.add_url_rule(PATHS.get(_key, f"/{_key}"), _key, make_view(_key))

@app.context_processor
def journey():
    keys = [c[0] for c in CHAPTERS]
    pos = keys.index(request.endpoint) if request.endpoint in keys else 0
    return dict(
        titles={k: t for k, t, _, _ in CHAPTERS}, roman=ROMAN, pos=pos, total=len(CHAPTERS), stops=CHAPTERS,
        prev=keys[pos - 1] if pos > 0 else None, nxt=keys[pos + 1] if pos < len(keys) - 1 else None,
    )

@app.errorhandler(404)
def not_found(_):
    return render_template("index.html"), 404

# -------------------------------------------------------------------- API
def ollama_error(exc):
    if isinstance(exc, requests.ConnectionError):
        return "Veritas is resting: Ollama is not running on the laptop. The rest of the exhibit still works.", 503
    if isinstance(exc, requests.Timeout):
        return "Veritas is taking too long. Please try a shorter question.", 504
    return "Something went wrong while Veritas was thinking. Please try again.", 502

def parse_request():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    if not message:
        return None, None, (jsonify(error="Please write a question or thought first."), 400)
    if len(message) > MAX_INPUT:
        return None, None, (jsonify(error=f"Please keep your message under {MAX_INPUT} characters."), 400)
    history = []
    for m in (data.get("history") or [])[-MAX_HISTORY:]:
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
            history.append({"role": m["role"], "content": m["content"][:1500]})
    return message, history, None

def build_payload(message, history, stream):
    system = PERSONA + "\n\nKNOWLEDGE (your source of facts about the exhibit):\n" + knowledge_for(message)
    return {
        "model": MODEL,
        "stream": stream,
        "messages": [{"role": "system", "content": system}, *history, {"role": "user", "content": message}],
        "options": {"temperature": 0.6, "num_predict": 320, "num_ctx": 4096},
    }

@app.get("/api/health")
def health():
    kb = sorted(load_kb())
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        names = [m.get("name", "") for m in r.json().get("models", [])]
        ready = MODEL in names or (":" not in MODEL and f"{MODEL}:latest" in names)
        return jsonify(ollama=True, model=MODEL, model_ready=ready, knowledge=kb)
    except requests.RequestException:
        return jsonify(ollama=False, model=MODEL, model_ready=False, knowledge=kb)

@app.post("/api/chat")
def chat():
    message, history, err = parse_request()
    if err:
        return err
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=build_payload(message, history, False), timeout=180)
        if r.status_code == 404:
            return jsonify(error=f"Model '{MODEL}' is not installed. Run: ollama pull {MODEL}"), 503
        r.raise_for_status()
        reply = r.json().get("message", {}).get("content", "").strip()
        if not reply:
            return jsonify(error="Veritas returned an empty answer. Please try again."), 502
        return jsonify(reply=reply)
    except requests.RequestException as exc:
        msg, code = ollama_error(exc)
        return jsonify(error=msg), code

@app.post("/api/chat/stream")
def chat_stream():
    """Same as /api/chat, but words arrive as they are written (much faster to first word)."""
    message, history, err = parse_request()
    if err:
        return err
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=build_payload(message, history, True), stream=True, timeout=(5, 180))
        if r.status_code == 404:
            r.close()
            return jsonify(error=f"Model '{MODEL}' is not installed. Run: ollama pull {MODEL}"), 503
        r.raise_for_status()
    except requests.RequestException as exc:
        msg, code = ollama_error(exc)
        return jsonify(error=msg), code

    def pieces():
        try:
            for line in r.iter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                piece = obj.get("message", {}).get("content", "")
                if piece:
                    yield piece
                if obj.get("done"):
                    break
        except requests.RequestException:
            pass
        finally:
            r.close()

    return Response(stream_with_context(pieces()), mimetype="text/plain; charset=utf-8",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
