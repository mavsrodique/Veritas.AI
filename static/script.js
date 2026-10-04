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
  if (lite) root.classList.add("lite");

  // Ambient particles (CSS-animated; fewer on small/low-end phones)
  var pc = $(".particles");
  if (pc && !reduce) {
    var n = lite ? 6 : innerWidth < 700 ? 10 : 18,
      frag = d.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var p = d.createElement("i");
      p.style.cssText =
        "left:" +
        Math.random() * 100 +
        "%;--s:" +
        (2 + Math.random() * 4) +
        "px;--x:" +
        (Math.random() - 0.5) * 80 +
        "px;--d:" +
        (14 + Math.random() * 16) +
        "s;animation-delay:-" +
        Math.random() * 20 +
        "s";
      if (i % 3 === 0) p.className = "r";
      frag.appendChild(p);
    }
    pc.appendChild(frag);
  }

  // Scroll-triggered staggered reveals
  var sel = [
    ".page-head>*",
    ".entrance-text>*",
    ".wrap>h2",
    ".wrap>p",
    ".prose>*:not(.steps):not(.page-head)",
    ".steps>*",
    ".stations>li",
    ".exhibit>figure",
    ".exhibit>div>*",
    ".feathers>*",
  ];
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          el.classList.add("in");
          io.unobserve(el);
          setTimeout(function () {
            el.removeAttribute("data-reveal");
            el.classList.remove("in");
            el.style.removeProperty("--i");
          }, 1400);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
    );
    $$(sel.join(",")).forEach(function (el) {
      if (el.hasAttribute("data-reveal")) return;
      var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.setAttribute("data-reveal", "");
      el.style.setProperty("--i", Math.min(idx, 7));
      io.observe(el);
    });
  }

  // Gentle parallax (rAF-throttled, transform only)
  var par = $$("[data-parallax]");
  if (par.length && !reduce && !lite) {
    var busy = false;
    addEventListener(
      "scroll",
      function () {
        if (busy) return;
        busy = true;
        requestAnimationFrame(function () {
          var y = window.pageYOffset;
          par.forEach(function (el) {
            el.style.transform =
              "translate3d(0," +
              (y * el.getAttribute("data-parallax")).toFixed(1) +
              "px,0)";
          });
          busy = false;
        });
      },
      { passive: true },
    );
  }

  // Page fade-out before navigating
  d.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (
      !a ||
      reduce ||
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      a.target === "_blank" ||
      a.origin !== location.origin
    )
      return;
    if (a.pathname === location.pathname) return;
    e.preventDefault();
    d.body.classList.add("leaving");
    setTimeout(function () {
      location.href = a.href;
    }, 170);
  });
  addEventListener("pageshow", function (e) {
    if (e.persisted) d.body.classList.remove("leaving");
  });
  d.addEventListener("visibilitychange", function () {
    root.classList.toggle("paused", d.hidden);
  });

  // "More" bottom sheet
  var more = $("#more"),
    sheet = $("#sheet"),
    scrim = $("#scrim");
  function setSheet(o) {
    sheet.classList.toggle("open", o);
    scrim.classList.toggle("open", o);
    more.setAttribute("aria-expanded", o);
  }
  if (more) {
    more.addEventListener("click", function () {
      setSheet(!sheet.classList.contains("open"));
    });
    scrim.addEventListener("click", function () {
      setSheet(false);
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setSheet(false);
    });
  }

  // Reflection cards: smooth expand, one open at a time
  $$(".feather").forEach(function (f) {
    var b = $(".f-head", f);
    b.addEventListener("click", function () {
      var open = !f.classList.contains("open");
      $$(".feather.open").forEach(function (o) {
        o.classList.remove("open");
        $(".f-head", o).setAttribute("aria-expanded", "false");
      });
      f.classList.toggle("open", open);
      b.setAttribute("aria-expanded", open);
      if (open)
        setTimeout(function () {
          f.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "nearest",
          });
        }, 420);
    });
  });

  // Veritas AI
  var form = $("#form");
  if (!form) return;
  var log = $("#log"),
    input = $("#input"),
    send = $("#send"),
    status = $("#status"),
    hist = [];

  fetch("/api/health")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j.ollama) {
        status.textContent =
          "Veritas is resting. Ollama is not running on the laptop.";
        status.className = "status bad";
      } else if (!j.model_ready) {
        status.textContent =
          "Ollama is running, but model " + j.model + " is not installed yet.";
        status.className = "status bad";
      } else {
        status.textContent = "Veritas is awake.";
        status.className = "status ok";
      }
    })
    .catch(function () {
      status.textContent = "Cannot reach the exhibit server.";
      status.className = "status bad";
    });

  function bottom() {
    log.scrollTop = log.scrollHeight;
  }
  function add(text, who) {
    var m = d.createElement("div"),
      p = d.createElement("p");
    m.className = "msg " + who;
    p.textContent = text;
    m.appendChild(p);
    log.appendChild(m);
    bottom();
    return p;
  }
  function typeOut(el, text) {
    if (reduce) {
      el.textContent = text;
      bottom();
      return;
    }
    var w = text.split(/(\s+)/),
      i = 0,
      step = Math.max(2, Math.ceil(w.length / 70));
    (function tick() {
      i += step;
      el.textContent = w.slice(0, i).join("");
      bottom();
      if (i < w.length) setTimeout(tick, 28);
    })();
  }
  function typing() {
    var m = d.createElement("div");
    m.className = "msg bot typing";
    m.setAttribute("aria-label", "Veritas is reflecting");
    m.innerHTML = "<p><i></i><i></i><i></i></p>";
    log.appendChild(m);
    bottom();
    return m;
  }
  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  function ask(text) {
    text = text.trim();
    if (!text) return;
    add(text, "user");
    input.value = "";
    grow();
    $("#suggest").hidden = true;
    send.disabled = true;
    send.classList.add("busy");
    var t = typing();
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: hist }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        t.remove();
        if (res.ok) {
          typeOut(add("", "bot"), res.j.reply);
          hist.push(
            { role: "user", content: text },
            { role: "assistant", content: res.j.reply },
          );
          hist = hist.slice(-12);
        } else add(res.j.error || "Something went wrong.", "bot err");
      })
      .catch(function () {
        t.remove();
        add(
          "Cannot reach the server. Check that your phone is still on the laptop's hotspot.",
          "bot err",
        );
      })
      .then(function () {
        send.disabled = false;
        send.classList.remove("busy");
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
  });
  input.addEventListener("input", grow);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && innerWidth >= 900) {
      e.preventDefault();
      ask(input.value);
    }
  });
  input.addEventListener("focus", function () {
    d.body.classList.add("typing");
    setTimeout(function () {
      form.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 300);
  });
  input.addEventListener("blur", function () {
    d.body.classList.remove("typing");
  });
  $$("#suggest button").forEach(function (b) {
    b.addEventListener("click", function () {
      ask(b.textContent);
    });
  });
})();
