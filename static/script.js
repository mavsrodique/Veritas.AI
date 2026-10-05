(function () {
  "use strict";
  var d = document,
    root = d.documentElement;
  var $ = function (s, r) {
    return (r || d).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || d).querySelectorAll(s));
  };
  var reduce =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lite =
    (navigator.hardwareConcurrency || 8) <= 4 ||
    (navigator.deviceMemory || 4) <= 2;
  var hasIO = "IntersectionObserver" in window;
  if (hasIO && !reduce) root.classList.add("rv"); // reveals exist only if they can actually fire

  // Dust in the museum light (few, slow, faint)
  var dust = $(".dust");
  if (dust && !reduce) {
    var n = lite ? 5 : innerWidth < 700 ? 7 : 12,
      frag = d.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var m = d.createElement("i");
      m.style.cssText =
        "left:" +
        Math.random() * 100 +
        "%;--s:" +
        (1.5 + Math.random() * 2.5) +
        "px;--x:" +
        (Math.random() - 0.5) * 60 +
        "px;--d:" +
        (22 + Math.random() * 20) +
        "s;animation-delay:-" +
        Math.random() * 30 +
        "s";
      frag.appendChild(m);
    }
    dust.appendChild(frag);
  }

  // One rAF-throttled scroll loop: header, progress, parallax, and per-scene progress (--p)
  var top = $(".top"),
    prog = $(".prog"),
    pars = $$("[data-par]"),
    scenes = $$(".scene,.threshold,.chamber");
  var ticking = false;
  if (reduce)
    scenes.forEach(function (s) {
      s.style.setProperty("--p", ".8");
    });
  function frame() {
    ticking = false;
    var vh = innerHeight,
      y = window.pageYOffset;
    top.classList.toggle("solid", y > 24);
    prog.style.transform =
      "scaleX(" +
      Math.min(1, y / Math.max(1, root.scrollHeight - vh)).toFixed(3) +
      ")";
    if (reduce) return;
    if (!lite)
      pars.forEach(function (el) {
        el.style.transform =
          "translate3d(0," +
          (y * el.getAttribute("data-par")).toFixed(1) +
          "px,0)";
      });
    var rects = scenes.map(function (s) {
      return s.getBoundingClientRect();
    });
    scenes.forEach(function (s, k) {
      var r = rects[k];
      if (r.bottom < -60 || r.top > vh + 60) return;
      s.style.setProperty(
        "--p",
        Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(3),
      );
    });
  }
  function req() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }
  addEventListener("scroll", req, { passive: true });
  addEventListener("resize", req);
  frame();

  // Gentle illumination as things enter view
  if (hasIO && !reduce) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    $$(".lit,h1,h2,.pair,.tl li").forEach(function (el) {
      io.observe(el);
    });
  }

  // Menu (full-screen drawer)
  var burger = $("#burger"),
    menu = $("#menu"),
    closeB = $("#menu-close");
  function setMenu(o) {
    menu.classList.toggle("open", o);
    root.classList.toggle("lock", o);
    burger.setAttribute("aria-expanded", o);
    menu.setAttribute("aria-hidden", !o);
    setTimeout(function () {
      (o ? closeB : burger).focus();
    }, 60);
  }
  burger.addEventListener("click", function () {
    setMenu(true);
  });
  closeB.addEventListener("click", function () {
    setMenu(false);
  });
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false);
  });

  // Rooms fade like gallery lights between visits
  d.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (
      !a ||
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      a.target === "_blank" ||
      a.origin !== location.origin
    )
      return;
    if (a.pathname === location.pathname) {
      if (!a.hash) {
        e.preventDefault();
        if (menu.classList.contains("open")) setMenu(false);
      }
      return;
    }
    if (reduce) return;
    e.preventDefault();
    d.body.classList.add("leaving");
    setTimeout(function () {
      location.href = a.href;
    }, 360);
  });
  addEventListener("pageshow", function (e) {
    if (e.persisted) d.body.classList.remove("leaving");
  });
  d.addEventListener("visibilitychange", function () {
    root.classList.toggle("paused", d.hidden);
  });

  // Two vocabularies
  $$(".pair button").forEach(function (b) {
    b.addEventListener("click", function () {
      var li = b.closest(".pair"),
        o = !li.classList.contains("open");
      li.classList.toggle("open", o);
      b.setAttribute("aria-expanded", o);
    });
  });

  // One quiet minute
  var bb = $("#breath-btn");
  if (bb) {
    var box = $("#breath"),
      bt = $("#breath-text"),
      timer = null,
      t = 0;
    var stop = function (msg) {
      clearInterval(timer);
      timer = null;
      box.classList.remove("running");
      bb.textContent = "Begin again";
      bt.textContent = msg || "Ready when you are.";
    };
    bb.addEventListener("click", function () {
      if (timer) {
        stop();
        return;
      }
      t = 0;
      box.classList.add("running");
      bb.textContent = "Stop";
      bt.textContent = "Breathe in...";
      timer = setInterval(function () {
        t++;
        if (t >= 60) {
          stop("Now return to the board.");
          return;
        }
        bt.textContent =
          Math.floor(t / 4) % 2 === 0 ? "Breathe in..." : "Breathe out...";
      }, 1000);
    });
  }

  // ---------------------------------------------------------------- Veritas
  var form = $("#form");
  if (!form) return;
  var log = $("#log"),
    input = $("#input"),
    send = $("#send"),
    status = $("#status"),
    fold = $("#fold"),
    hist = [],
    busy = false;

  fetch("/api/health")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j.ollama)
        setStatus(
          "Veritas is resting. Ollama is not running on the laptop.",
          "bad",
        );
      else if (!j.model_ready)
        setStatus(
          "Ollama is awake, but model " + j.model + " is not installed.",
          "bad",
        );
      else setStatus("Veritas is present", "ok");
    })
    .catch(function () {
      setStatus("The exhibit server cannot be reached", "bad");
    });
  function setStatus(txt, cls) {
    status.textContent = txt;
    status.className = "status " + cls;
  }

  function nearBottom() {
    return innerHeight + window.pageYOffset > root.scrollHeight - 200;
  }
  function toEnd(smooth) {
    window.scrollTo({
      top: root.scrollHeight,
      behavior: smooth && !reduce ? "smooth" : "auto",
    });
  }
  function turn(cls, text) {
    var a = d.createElement("article"),
      p = d.createElement("p");
    a.className = "turn " + cls;
    p.textContent = text;
    a.appendChild(p);
    log.appendChild(a);
    return a;
  }
  function thinking() {
    var t = d.createElement("div");

    t.className = "thinking";

    t.innerHTML =
      '<span class="o"><i></i><i></i></span><em>Veritas is reflecting</em>';

    log.appendChild(t);

    var em = $("em", t);

    t._a = setTimeout(function () {
      em.textContent = "Gathering the right words";
    }, 4000);

    if (hist.length === 0) {
      t._b = setTimeout(function () {
        em.textContent = "The model is waking and preparing its first reply";
      }, 12000);
    }

    return t;
  }
  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 130) + "px";
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    fold.classList.add("gone");
    $("#chamber").classList.add("talking");
    turn("you", text);
    input.value = "";
    grow();
    toEnd(true);
    var th = thinking(),
      art = null,
      out = "";
    function done() {
      clearTimeout(th._a);
      clearTimeout(th._b);
      th.remove();
    }
    try {
      var res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: hist }),
      });
      if (!res.ok) {
        var j = await res.json().catch(function () {
          return {};
        });
        throw new Error(j.error || "Something went wrong.");
      }
      if (res.body && res.body.getReader) {
        var rd = res.body.getReader(),
          dec = new TextDecoder();
        for (;;) {
          var c = await rd.read();
          if (c.done) break;
          out += dec.decode(c.value, { stream: true });
          if (!art && out.trim()) {
            done();
            art = turn("veritas live", "");
          }
          if (art) {
            var stick = nearBottom();
            $("p", art).textContent = out.trim();
            if (stick) toEnd(false);
          }
        }
      } else {
        // very old browsers: whole answer at once
        var r2 = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: hist }),
        });
        var j2 = await r2.json();
        if (!r2.ok) throw new Error(j2.error);
        out = j2.reply;
        done();
        art = turn("veritas", out);
      }
      if (!out.trim())
        throw new Error(
          "Veritas had nothing to say just then. Please try again.",
        );
      art.classList.remove("live");
      hist.push(
        { role: "user", content: text },
        { role: "assistant", content: out.trim() },
      );
      hist = hist.slice(-12);
    } catch (err) {
      done();
      if (art) art.classList.remove("live");
      turn(
        "note",
        err && err.message && err.message !== "Failed to fetch"
          ? err.message
          : "The connection was lost. Check that your phone is still on the laptop's hotspot.",
      );
    }
    busy = false;
    send.disabled = false;
    toEnd(true);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
  });
  input.addEventListener("input", grow);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && innerWidth >= 960) {
      e.preventDefault();
      ask(input.value);
    }
  });
  $$("#suggest button").forEach(function (b) {
    b.addEventListener("click", function () {
      ask(b.textContent);
    });
  });
})();
