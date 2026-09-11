/**
 * Courses 404 — Shared Player Engine & Progress State
 * Handles AES-256-CTR WebCrypto decryption, course metadata parsing,
 * banner generation, and persistent progress tracking.
 */
"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CourseEngine = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {

  const KDF_ITER = 600000;
  const PROGRESS_KEY = "courses404_progress_v2";
  const VIDEO_EXT = ["webm", "mp4", "mov", "m4v", "mkv", "ogv"];
  const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "svg"];

  /* ═══════════════ LOCAL STORAGE PROGRESS ENGINE ═══════════════ */

  function loadAllProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("Could not read progress from localStorage", e);
      return {};
    }
  }

  function saveAllProgress(data) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save progress to localStorage", e);
    }
  }

  function getCourseProgress(courseTag) {
    const all = loadAllProgress();
    const courseData = all[courseTag] || {};
    return {
      completed: Array.isArray(courseData.completed) ? courseData.completed : [],
      lastLesson: courseData.lastLesson || null,
      lastTime: courseData.lastTime || 0,
      updatedAt: courseData.updatedAt || null
    };
  }

  function setLessonCompleted(courseTag, assetName, isCompleted) {
    const all = loadAllProgress();
    if (!all[courseTag]) {
      all[courseTag] = { completed: [], lastLesson: assetName, lastTime: 0, updatedAt: Date.now() };
    }
    const list = new Set(all[courseTag].completed || []);
    if (isCompleted) {
      list.add(assetName);
    } else {
      list.delete(assetName);
    }
    all[courseTag].completed = Array.from(list);
    all[courseTag].updatedAt = Date.now();
    saveAllProgress(all);
    return all[courseTag];
  }

  function setLastPlayed(courseTag, assetName, currentTime) {
    const all = loadAllProgress();
    if (!all[courseTag]) {
      all[courseTag] = { completed: [], lastLesson: null, lastTime: 0 };
    }
    all[courseTag].lastLesson = assetName;
    if (typeof currentTime === "number") {
      all[courseTag].lastTime = Math.max(0, currentTime);
    }
    all[courseTag].updatedAt = Date.now();
    saveAllProgress(all);
  }

  function calculateCourseStats(courseTag, totalLessonsCount) {
    const prog = getCourseProgress(courseTag);
    const completedCount = prog.completed.length;
    const total = totalLessonsCount || 1;
    const percent = Math.min(100, Math.round((completedCount / total) * 100));
    return {
      completedCount: completedCount,
      totalCount: totalLessonsCount,
      percent: percent,
      isStarted: completedCount > 0 || !!prog.lastLesson,
      isCompleted: totalLessonsCount > 0 && completedCount >= totalLessonsCount,
      lastLesson: prog.lastLesson,
      lastTime: prog.lastTime
    };
  }

  function getOverallLearningStats(sections) {
    const all = loadAllProgress();
    let totalCourses = sections.length;
    let coursesInProgress = 0;
    let coursesCompleted = 0;
    let totalCompletedLessons = 0;

    for (const sec of sections) {
      const secStats = calculateCourseStats(sec.tag, sec.videos.length);
      totalCompletedLessons += secStats.completedCount;
      if (secStats.isCompleted) {
        coursesCompleted++;
      } else if (secStats.isStarted) {
        coursesInProgress++;
      }
    }

    return {
      totalCourses,
      coursesInProgress,
      coursesCompleted,
      totalCompletedLessons
    };
  }

  /* ═══════════════ WEBCRYPTO DECRYPTION (AES-256-CTR) ═══════════════ */

  async function decryptEnc(buf, pass) {
    const u8 = new Uint8Array(buf);
    if (u8.length < 32 || String.fromCharCode.apply(null, u8.subarray(0, 8)) !== "Salted__") {
      throw new Error("not a valid lesson file (missing Salted__ prefix)");
    }
    const salt = u8.subarray(8, 16);
    const ct = u8.subarray(16);
    const km = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pass),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt, iterations: KDF_ITER, hash: "SHA-256" },
        km,
        384
      )
    );
    const key = await crypto.subtle.importKey(
      "raw",
      bits.subarray(0, 32),
      "AES-CTR",
      false,
      ["decrypt"]
    );
    return await crypto.subtle.decrypt(
      { name: "AES-CTR", counter: bits.subarray(32, 48), length: 64 },
      key,
      ct
    );
  }

  function isWebM(buf) {
    const u8 = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    return u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3;
  }

  const blobCache = new Map(); // key -> { url, size }

  function cachePut(key, blob) {
    if (blobCache.has(key)) {
      const hit = blobCache.get(key);
      blobCache.delete(key);
      blobCache.set(key, hit);
      return hit.url;
    }
    const url = URL.createObjectURL(blob);
    blobCache.set(key, { url: url, size: blob.size });
    while (blobCache.size > 5) {
      const oldest = blobCache.keys().next().value;
      try {
        URL.revokeObjectURL(blobCache.get(oldest).url);
      } catch (e) {}
      blobCache.delete(oldest);
    }
    return url;
  }

  async function fetchWithProgress(url, onPct) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const total = parseInt(res.headers.get("content-length") || "0", 10);
    if (!res.body || !total) return await res.arrayBuffer();
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      chunks.push(r.value);
      got += r.value.length;
      if (total && onPct) onPct(Math.min(99, Math.round((got * 100) / total)));
    }
    const out = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    if (onPct) onPct(100);
    return out.buffer;
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }

  /* ═══════════════ FORMATTING & STRING HELPERS ═══════════════ */

  function formatBytes(n) {
    if (!isFinite(n) || n <= 0) return "0 B";
    const u = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + u[i];
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function splitAssetName(name) {
    const i = name.lastIndexOf("__");
    if (i > 0 && i < name.length - 2) {
      return { folder: name.slice(0, i), title: name.slice(i + 2) };
    }
    return { folder: "", title: name };
  }

  function isEncryptedName(name) {
    return /\.webm\.enc$/i.test(name || "");
  }

  function prettyTitle(name) {
    const parts = splitAssetName(name);
    return parts.title
      .replace(/\.webm\.enc$/i, "")
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .replace(/^[0-9]+[.\-_\s]+/i, function (m) {
        return m.replace(/[-_]+/g, " ");
      })
      .trim();
  }

  function cleanCourseTitle(title) {
    if (!title) return "Untitled Course";
    return title.trim();
  }

  /**
   * Intelligently parses instructor, category, and badge from course title.
   */
  function extractCourseMeta(title) {
    const raw = title || "";
    let instructor = "";
    let category = "General";
    let icon = "🎓";
    let badgeColor = "#0d6b4f";

    const byMatch = raw.match(/\b(?:by|By)\s+([A-Za-z0-9\s&]+?)(?:[❤🦋🎶📚☀️🤖🎀🌜😎🔖❤]|$)/);
    if (byMatch && byMatch[1]) {
      instructor = byMatch[1].trim();
    } else {
      const dashMatch = raw.match(/[-—–]\s*([A-Za-z0-9\s&]{3,24})/);
      if (dashMatch && dashMatch[1] && !/batch|cohort|course|part|module/i.test(dashMatch[1])) {
        instructor = dashMatch[1].trim();
      }
    }

    const t = raw.toLowerCase();
    if (t.includes("youtube") || t.includes("video") || t.includes("davinci") || t.includes("premiere") || t.includes("editing")) {
      category = "Video & YouTube";
      icon = "🎥";
      badgeColor = "#c0392b";
    } else if (t.includes("ai ") || t.includes("sora") || t.includes("framer") || t.includes("visual") || t.includes("cartoon")) {
      category = "AI & Production";
      icon = "🤖";
      badgeColor = "#7952b3";
    } else if (t.includes("tiktok") || t.includes("faceless") || t.includes("automation")) {
      category = "Automation & Growth";
      icon = "⚡";
      badgeColor = "#e67e22";
    } else if (t.includes("marketing") || t.includes("ad coaching") || t.includes("startup") || t.includes("profit")) {
      category = "Digital Marketing";
      icon = "📈";
      badgeColor = "#16a085";
    } else if (t.includes("amazon") || t.includes("money") || t.includes("passive income") || t.includes("excel")) {
      category = "Business & Income";
      icon = "💼";
      badgeColor = "#2980b9";
    }

    return {
      instructor: instructor || "Featured Instructor",
      category,
      icon,
      badgeColor
    };
  }

  /**
   * Generates a dynamic palette for the course banner
   */
  function generateBannerStyle(title) {
    const palettes = [
      { bg: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)", accent: "#00c6ff" },
      { bg: "linear-gradient(135deg, #141e30 0%, #243b55 100%)", accent: "#4ca1af" },
      { bg: "linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)", accent: "#e0c3fc" },
      { bg: "linear-gradient(135deg, #0d1b2a 0%, #1b263b 50%, #415a77 100%)", accent: "#778da9" },
      { bg: "linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)", accent: "#fdbb2d" },
      { bg: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", accent: "#38ef7d" },
      { bg: "linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)", accent: "#ffaf7b" },
      { bg: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)", accent: "#5ee7df" },
      { bg: "linear-gradient(135deg, #000428 0%, #004e92 100%)", accent: "#00c6ff" }
    ];
    let hash = 0;
    const str = title || "course";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % palettes.length;
    return palettes[idx];
  }

  /* ═══════════════ CURRICULUM STRUCTURING ═══════════════ */

  function structureCurriculum(videos) {
    const sectionMap = new Map();

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const parts = splitAssetName(v.name);
      const folderName = parts.folder ? parts.folder.replace(/_+/g, " ").trim() : "Course Lessons";

      if (!sectionMap.has(folderName)) {
        sectionMap.set(folderName, []);
      }
      sectionMap.get(folderName).push({
        asset: v,
        index: i + 1,
        title: prettyTitle(v.name),
        sizeText: formatBytes(v.size),
        rawFolder: parts.folder
      });
    }

    const sections = [];
    let sectionIdx = 1;
    for (const [title, items] of sectionMap.entries()) {
      sections.push({
        id: "section-" + sectionIdx,
        index: sectionIdx,
        title: title,
        items: items
      });
      sectionIdx++;
    }
    return sections;
  }

  /* ═══════════════ GITHUB MODEL BUILDER ═══════════════ */

  function buildCourseModel(releases) {
    const rawSections = [];
    for (const r of releases) {
      const assets = (r.assets || []).filter(function (a) { return a.state !== "draft"; });
      if (!assets.length) continue;
      const videos = [], others = [], images = [];
      for (const a of assets) {
        const name = a.name || "";
        const ext = (name.split(".").pop() || "").toLowerCase();

        if (isEncryptedName(name)) {
          a.enc = true;
          videos.push(a);
        } else if (VIDEO_EXT.indexOf(ext) >= 0) {
          a.enc = false;
          videos.push(a);
        } else if (IMAGE_EXT.indexOf(ext) >= 0) {
          images.push(a);
        } else {
          others.push(a);
        }
      }
      if (!videos.length) continue;
      videos.sort(function (a, b) {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      const total = videos.reduce(function (s, a) { return s + (a.size || 0); }, 0);
      rawSections.push({
        tag: r.tag_name || "",
        title: r.name || r.tag_name || "Release",
        date: r.created_at || "",
        videos: videos,
        others: others,
        images: images,
        total: total
      });
    }

    const byTitle = new Map();
    const sections = [];
    for (const s of rawSections) {
      const normKey = (s.title || "").trim().toLowerCase();
      if (!byTitle.has(normKey)) {
        byTitle.set(normKey, s);
        sections.push(s);
      } else {
        const existing = byTitle.get(normKey);
        const existingNames = new Set(existing.videos.map(function (v) { return v.name; }));
        for (const v of s.videos) {
          if (!existingNames.has(v.name)) {
            existing.videos.push(v);
            existingNames.add(v.name);
          }
        }
        for (const img of s.images) {
          if (!existing.images.some(function (x) { return x.name === img.name; })) {
            existing.images.push(img);
          }
        }
        for (const o of s.others) {
          if (!existing.others.some(function (x) { return x.name === o.name; })) {
            existing.others.push(o);
          }
        }
        existing.videos.sort(function (a, b) {
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        });
        existing.total = existing.videos.reduce(function (tot, a) { return tot + (a.size || 0); }, 0);
        if (new Date(s.date) > new Date(existing.date)) {
          existing.date = s.date;
          existing.tag = s.tag;
        }
      }
    }

    sections.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return sections;
  }

  /* ═══════════════ REPO DETECTION ═══════════════ */

  function detectRepo(loc) {
    if (typeof window.SITE_REPO === "object" && window.SITE_REPO &&
        window.SITE_REPO.owner && window.SITE_REPO.repo) {
      return { owner: window.SITE_REPO.owner, repo: window.SITE_REPO.repo };
    }
    const m = String(loc.hostname || "").match(/^([^.]+)\.github\.io$/i);
    if (m && m[1].toLowerCase() !== "pages") {
      const repo = (loc.pathname || "/").split("/")[1];
      if (repo) return { owner: m[1], repo: decodeURIComponent(repo).replace(/\.html$/, "").replace(/\/$/, "") };
    }
    return null;
  }

  return {
    KDF_ITER,
    PROGRESS_KEY,
    VIDEO_EXT,
    loadAllProgress,
    saveAllProgress,
    getCourseProgress,
    setLessonCompleted,
    setLastPlayed,
    calculateCourseStats,
    getOverallLearningStats,
    decryptEnc,
    isWebM,
    cachePut,
    blobCache,
    fetchWithProgress,
    b64ToBytes,
    formatBytes,
    formatDate,
    splitAssetName,
    isEncryptedName,
    prettyTitle,
    cleanCourseTitle,
    extractCourseMeta,
    generateBannerStyle,
    structureCurriculum,
    buildCourseModel,
    detectRepo
  };
});
