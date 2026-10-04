"""Digital companion to the bulletin board:
St. Thomas of Villanova - Model of Augustinian Interiority in the Age of AI.
Run:  python app.py   (then open http://<laptop-ip>:5000 on a phone)
"""

import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("VERITAS_MODEL", "qwen2.5:3b")
MAX_INPUT = 600
MAX_HISTORY = 6

EXHIBIT_CONTEXT = """
EXHIBIT TITLE

St. Thomas of Villanova:
Model of Augustinian Interiority in the Age of Artificial Intelligence

CORE MESSAGE

As Artificial Intelligence becomes more powerful, the need for self-awareness,
reflection, wisdom, compassion, and moral responsibility becomes even more important.

LOOK WITHIN

The phrase 'Look Within' represents the core idea of Augustinian Interiority.
It encourages people to examine their thoughts, values, decisions, and actions.

ST. THOMAS OF VILLANOVA

St. Thomas of Villanova was a Spanish Augustinian friar and Archbishop of Valencia.
He was known for humility, generosity, charity, compassion, and service to the poor.
His life reminds us that true wisdom is expressed through love and service to others.

AUGUSTINIAN INTERIORITY

Augustinian Interiority is the practice of looking within oneself through reflection,
self-awareness, introspection, and honest self-examination. It teaches that understanding
oneself is essential for personal growth, wisdom, and the search for truth.

PELICAN SYMBOLISM

The pelican symbolizes sacrifice, charity, generosity, and self-giving love.
It reflects the life and example of St. Thomas of Villanova and reminds visitors
that compassion and service remain essential human values.

MIRROR SYMBOLISM

The mirror beneath the pelican symbolizes self-reflection, introspection,
self-awareness, and Augustinian Interiority. It invites visitors to look within
themselves and examine their beliefs, actions, values, and purpose.

FEATHER SYMBOLISM

The feathers symbolize reflection, personal growth, self-discovery,
and the journey toward wisdom.

The exhibit contains physical pullable feathers with reflection questions.

IMPORTANT:
Do NOT reveal, generate, guess, recreate, or list the feather questions.
If asked about them, encourage visitors to interact with the physical exhibit.

GEAR SYMBOLISM

The gears symbolize technology, innovation, systems, progress,
and Artificial Intelligence.

CIRCUIT SYMBOLISM

The circuit patterns symbolize data, information, algorithms,
digital systems, and the technological foundations of Artificial Intelligence.

BRAIN SYMBOLISM

The brain symbolizes knowledge, understanding, wisdom,
discernment, learning, and human thought.

ARTIFICIAL INTELLIGENCE

Artificial Intelligence is presented as a powerful tool capable of
assisting people, supporting learning, improving efficiency,
and helping solve problems.

AI should be used responsibly and ethically.

AI AND HUMANITY

Artificial Intelligence can process information rapidly,
but human beings possess conscience, empathy,
moral judgment, wisdom, and self-awareness.

The exhibit encourages people to use technology responsibly
while continuing to develop their humanity.
"""

SYSTEM_PROMPT = (
    "You are Veritas AI, the official educational companion of the exhibit "
    "'St. Thomas of Villanova: Model of Augustinian Interiority in the Age of Artificial Intelligence.' "
    "Your purpose is to help visitors understand the exhibit's symbolism, themes, and message. "
    "You may discuss St. Thomas of Villanova, Augustinian Interiority, self-reflection, truth, "
    "wisdom, charity, compassion, human dignity, ethical technology, and the relationship between "
    "humanity and Artificial Intelligence. "
    "Use the exhibit information provided to answer questions accurately. "
    "Do not invent facts, stories, historical details, or symbolism not found in the exhibit information. "
    "Keep responses concise, educational, thoughtful, and easy to understand. "
    "Most answers should be 2-5 short paragraphs unless additional detail is requested. "
    "If information is not available in the exhibit information, say: "
    "'The exhibit does not provide enough information for me to answer that accurately.' "
    "Do not reveal, recreate, generate, or guess the contents of the physical pullable-feather questions. "
    "If asked about them, encourage visitors to interact with the physical exhibit instead. "
    "If a question is unrelated to the exhibit, politely explain that Veritas AI is designed specifically "
    "to discuss the themes and symbolism of this exhibit. "
    "You are not a replacement for conscience, wisdom, spirituality, human relationships, "
    "moral judgment, or self-reflection."
    "Keep answers under 120 words unless more detail is requested."
)

PAGES = {
    "index": "index.html",
    "about": "about.html",
    "thomas": "thomas.html",
    "interiority": "interiority.html",
    "symbolism": "symbolism.html",
    "reflections": "reflections.html",
    "ai": "ai.html",
}


def make_view(name, tpl):
    def view():
        return render_template(tpl)

    view.__name__ = name
    return view


for _name, _tpl in PAGES.items():
    path = "/" if _name == "index" else f"/{_name}"
    app.add_url_rule(path, _name, make_view(_name, _tpl))


@app.errorhandler(404)
def not_found(_):
    return render_template("index.html"), 404


@app.get("/api/health")
def health():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        names = [m.get("name", "") for m in r.json().get("models", [])]
        ready = MODEL in names or (":" not in MODEL and f"{MODEL}:latest" in names)
        return jsonify(ollama=True, model=MODEL, model_ready=ready)
    except requests.RequestException:
        return jsonify(ollama=False, model=MODEL, model_ready=False)


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    if not message:
        return jsonify(error="Please write a question or thought first."), 400
    if len(message) > MAX_INPUT:
        return (
            jsonify(error=f"Please keep your message under {MAX_INPUT} characters."),
            400,
        )

    history = []
    for m in (data.get("history") or [])[-MAX_HISTORY:]:
        if (
            isinstance(m, dict)
            and m.get("role") in ("user", "assistant")
            and isinstance(m.get("content"), str)
        ):
            history.append({"role": m["role"], "content": m["content"][:1500]})

    payload = {
        "model": MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *history,
            {"role": "user", "content": message},
        ],
        "options": {"temperature": 0.6, "num_predict": 300},
    }
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=180)
        if r.status_code == 404:
            return (
                jsonify(
                    error=f"Model '{MODEL}' is not installed. Run: ollama pull {MODEL}"
                ),
                503,
            )
        r.raise_for_status()
        reply = r.json().get("message", {}).get("content", "").strip()
        if not reply:
            return (
                jsonify(error="Veritas returned an empty answer. Please try again."),
                502,
            )
        return jsonify(reply=reply)
    except requests.ConnectionError:
        return (
            jsonify(
                error="Veritas AI is resting: Ollama is not running on the laptop. The rest of the exhibit still works."
            ),
            503,
        )
    except requests.Timeout:
        return (
            jsonify(error="Veritas is taking too long. Please try a shorter question."),
            504,
        )
    except requests.RequestException:
        return (
            jsonify(error="Something went wrong talking to Ollama. Please try again."),
            502,
        )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
