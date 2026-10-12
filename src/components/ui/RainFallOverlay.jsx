import React, { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/ThemeContext";
import {
  WEATHER_CHANGE_EVENT,
  WEATHER_CHANGED_EVENT,
  WEATHER_CYCLE_MS,
  WEATHER_EFFECT_KEY,
  WEATHER_EFFECT_OPTIONS,
  WEATHER_TOGGLE_HOTKEY,
  RAIN_SCOOTER_BANNER_TEXT,
  normalizeWeatherEffectKey,
} from "@/config/weatherEffect";
import "./rainFallOverlay.css";

const DENSITY = {
  light: 0.07,
  medium: 0.11,
  heavy: 0.16,
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

function matchesWeatherHotkey(event) {
  return (
    event.altKey === WEATHER_TOGGLE_HOTKEY.altKey &&
    event.code === WEATHER_TOGGLE_HOTKEY.code &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.repeat
  );
}

function nextWeatherKey(current) {
  const index = WEATHER_EFFECT_OPTIONS.indexOf(current);
  const next = (index + 1) % WEATHER_EFFECT_OPTIONS.length;
  return WEATHER_EFFECT_OPTIONS[next];
}

function activeKindFromKey(effectKey, autoKind) {
  if (effectKey === "snow") return "snow";
  if (effectKey === "rain") return "rain";
  if (effectKey === "bubbles") return "bubbles";
  if (effectKey === "sparkles") return "sparkles";
  if (effectKey === "fireflies") return "fireflies";
  if (effectKey === "auto") return autoKind;
  return null;
}

function nextAutoKind(kind) {
  if (kind === "rain") return "snow";
  if (kind === "snow") return "bubbles";
  if (kind === "bubbles") return "sparkles";
  if (kind === "sparkles") return "fireflies";
  return "rain";
}

function particleFactory(kind) {
  if (kind === "snow") return makeFlake;
  if (kind === "bubbles") return makeBubble;
  if (kind === "sparkles") return makeSparkle;
  if (kind === "fireflies") return makeFirefly;
  return makeDrop;
}

function particleCount(width, height, dropsPerPx) {
  return Math.max(
    140,
    Math.min(560, Math.round(((width * height) / 6200) * (dropsPerPx / 0.11))),
  );
}

function makeDrop(width, height) {
  const roll = Math.random();
  let kind = "mid";
  if (roll < 0.38) kind = "fine";
  else if (roll > 0.82) kind = "heavy";
  const alpha = randomBetween(0.08, 0.62);

  if (kind === "fine") {
    const len = randomBetween(6, 12);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      len,
      speed: randomBetween(3.2, 5.4),
      lineWidth: randomBetween(0.45, 0.85),
      alpha,
      drift: 0.08,
    };
  }
  if (kind === "heavy") {
    const len = randomBetween(22, 38);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      len,
      speed: randomBetween(8.5, 13.5),
      lineWidth: randomBetween(1.4, 2.4),
      alpha,
      drift: 0.16,
    };
  }
  const len = randomBetween(12, 22);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    len,
    speed: randomBetween(5.2, 8.8),
    lineWidth: randomBetween(0.8, 1.45),
    alpha,
    drift: 0.12,
  };
}

function makeFlake(width, height) {
  const roll = Math.random();
  let size;
  let speed;
  if (roll < 0.34) {
    size = randomBetween(3.6, 5.4);
    speed = randomBetween(0.4, 0.8);
  } else if (roll > 0.82) {
    size = randomBetween(8.5, 13);
    speed = randomBetween(0.55, 1.15);
  } else {
    size = randomBetween(5.4, 8.5);
    speed = randomBetween(0.48, 0.95);
  }
  const alpha = randomBetween(0.08, 0.62);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size,
    speed,
    alpha,
    drift: randomBetween(0.22, 0.75),
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: randomBetween(0.008, 0.018),
    spin: Math.random() * Math.PI * 2,
    spinSpeed: randomBetween(0.004, 0.012),
    style: Math.floor(Math.random() * 3),
  };
}

function makeBubble(width, height) {
  const roll = Math.random();
  let size;
  let speed;
  if (roll < 0.4) {
    size = randomBetween(5, 10);
    speed = randomBetween(0.35, 0.7);
  } else if (roll > 0.86) {
    size = randomBetween(18, 32);
    speed = randomBetween(0.45, 0.85);
  } else {
    size = randomBetween(10, 18);
    speed = randomBetween(0.4, 0.9);
  }
  const alpha = randomBetween(0.08, 0.62);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size,
    speed,
    alpha,
    rimAlpha: Math.min(0.95, alpha + randomBetween(0.12, 0.38)),
    highlightAlpha: Math.min(0.9, alpha + randomBetween(0.18, 0.45)),
    drift: randomBetween(0.18, 0.7),
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: randomBetween(0.01, 0.022),
  };
}

function makeSparkle(width, height) {
  const roll = Math.random();
  let size;
  if (roll < 0.45) size = randomBetween(1.4, 2.6);
  else if (roll > 0.88) size = randomBetween(4.2, 7.2);
  else size = randomBetween(2.6, 4.2);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size,
    speed: randomBetween(0.08, 0.35),
    alpha: randomBetween(0.08, 0.62),
    phase: Math.random() * Math.PI * 2,
    twinkleSpeed: randomBetween(0.04, 0.12),
    drift: randomBetween(0.08, 0.32),
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: randomBetween(0.006, 0.018),
    spin: Math.random() * Math.PI * 2,
    spinSpeed: randomBetween(-0.012, 0.012),
  };
}

function makeFirefly(width, height) {
  const warm = Math.random() < 0.62;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: randomBetween(1.2, 2.8),
    speed: randomBetween(0.22, 0.62),
    heading: Math.random() * Math.PI * 2,
    turn: randomBetween(0.008, 0.022) * (Math.random() < 0.5 ? -1 : 1),
    alpha: randomBetween(0.16, 0.72),
    phase: Math.random() * Math.PI * 2,
    blinkSpeed: randomBetween(0.028, 0.07),
    hue: warm ? randomBetween(42, 56) : randomBetween(78, 98),
    bob: Math.random() * Math.PI * 2,
    bobSpeed: randomBetween(0.01, 0.028),
  };
}

function makeFallingLeaf(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: randomBetween(5, 16),
    speed: randomBetween(0.5, 1.65),
    alpha: randomBetween(0.1, 0.68),
    hue: randomBetween(38, 56),
    light: randomBetween(46, 64),
    spin: Math.random() * Math.PI * 2,
    spinSpeed: randomBetween(-0.035, 0.035),
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: randomBetween(0.018, 0.042),
    drift: randomBetween(0.3, 0.95),
  };
}

function drawFallingLeaf(ctx, leaf) {
  const { x, y, size, alpha, hue, light, spin } = leaf;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = `hsla(${hue}, 88%, ${light}%, ${alpha})`;
  ctx.strokeStyle = `hsla(${hue}, 70%, ${Math.max(28, light - 18)}%, ${alpha * 0.7})`;
  ctx.lineWidth = Math.max(0.5, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.72, -size * 0.15, 0, size);
  ctx.quadraticCurveTo(-size * 0.72, -size * 0.15, 0, -size);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.82);
  ctx.lineTo(0, size * 0.78);
  ctx.moveTo(0, -size * 0.12);
  ctx.lineTo(size * 0.32, size * 0.08);
  ctx.moveTo(0, size * 0.18);
  ctx.lineTo(-size * 0.28, size * 0.38);
  ctx.stroke();
  ctx.restore();
}

const WIND_MS = 3000;
const REST_LEAN = -1;

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function windEnvelope(ageMs) {
  if (ageMs < 0 || ageMs >= WIND_MS) return 0;
  const t = ageMs / WIND_MS;
  const attackEnd = 0.22;
  const releaseStart = 0.4;
  if (t < attackEnd) return smoothstep(t / attackEnd);
  if (t > releaseStart) {
    return 1 - smoothstep((t - releaseStart) / (1 - releaseStart));
  }
  return 1;
}

function makeWindStreak(width, height, dir) {
  const fromLeft = dir > 0;
  return {
    x: fromLeft
      ? randomBetween(-120, width * 0.15)
      : randomBetween(width * 0.85, width + 120),
    y: randomBetween(0, height),
    len: randomBetween(48, 160),
    thick: randomBetween(0.55, 2),
    speed: randomBetween(16, 34),
    alpha: randomBetween(0.1, 0.32),
    lift: randomBetween(-0.6, 0.9),
    wobble: Math.random() * Math.PI * 2,
    kind: Math.random() < 0.22 ? "leaf" : "wisp",
  };
}

function drawWind(ctx, streaks, strength, dir, isDark, width, height) {
  if (strength <= 0.01 || !streaks.length) return;
  ctx.save();
  ctx.lineCap = "round";
  for (const streak of streaks) {
    streak.wobble += 0.12;
    streak.x += streak.speed * dir * (0.55 + strength * 1.15);
    streak.y += streak.lift + Math.sin(streak.wobble) * 0.7;
    const alpha = streak.alpha * strength;
    if (streak.kind === "leaf") {
      ctx.fillStyle = isDark
        ? `rgba(186, 220, 255, ${alpha * 0.85})`
        : `rgba(100, 140, 180, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(
        streak.x,
        streak.y,
        streak.len * 0.08,
        streak.thick * 1.4,
        dir * 0.45,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.strokeStyle = isDark
        ? `rgba(210, 230, 255, ${alpha})`
        : `rgba(120, 155, 190, ${alpha})`;
      ctx.lineWidth = streak.thick;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x - dir * streak.len, streak.y + streak.len * 0.08);
      ctx.stroke();
    }
    if (dir > 0 && streak.x > width + 80) {
      streak.x = -80;
      streak.y = randomBetween(0, height);
    } else if (dir < 0 && streak.x < -80) {
      streak.x = width + 80;
      streak.y = randomBetween(0, height);
    }
  }
  ctx.restore();
}

function makeBolt(width, height) {
  const startX = width * randomBetween(0.12, 0.88);
  const endY = height * randomBetween(0.42, 0.92);
  const segments = 9 + Math.floor(Math.random() * 8);
  const main = [{ x: startX, y: -8 }];
  let x = startX;
  let y = 0;
  for (let i = 0; i < segments; i += 1) {
    x += randomBetween(-42, 42);
    y += endY / segments + randomBetween(-6, 10);
    main.push({ x, y });
  }
  const branches = [];
  const branchCount = 1 + Math.floor(Math.random() * 3);
  for (let b = 0; b < branchCount; b += 1) {
    const from = 2 + Math.floor(Math.random() * Math.max(1, main.length - 4));
    const origin = main[from];
    if (!origin) continue;
    const branch = [{ x: origin.x, y: origin.y }];
    let bx = origin.x;
    let by = origin.y;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const segs = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < segs; i += 1) {
      bx += dir * randomBetween(12, 38);
      by += randomBetween(18, 46);
      branch.push({ x: bx, y: by });
    }
    branches.push(branch);
  }
  return { main, branches };
}

function strokePath(ctx, points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawFlake(ctx, flake) {
  const { x, y, size, spin, style, alpha } = flake;
  const inner = size * 0.2;
  const mid = size * (style === 1 ? 0.5 : 0.42);
  const far = size * (style === 2 ? 0.78 : 0.7);
  const branchA = size * (style === 0 ? 0.26 : 0.32);
  const branchB = size * 0.18;
  const white = `rgba(255, 255, 255, ${alpha})`;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = white;
  ctx.fillStyle = white;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.85, size * 0.14);
  ctx.shadowColor = `rgba(255, 255, 255, ${Math.min(0.9, alpha + 0.2)})`;
  ctx.shadowBlur = Math.max(2, size * 0.28);

  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = Math.cos(a) * inner;
    const py = Math.sin(a) * inner;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  for (let arm = 0; arm < 6; arm += 1) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, inner * 0.4);
    ctx.lineTo(0, size);
    ctx.moveTo(-branchA, mid + branchA * 0.45);
    ctx.lineTo(0, mid);
    ctx.lineTo(branchA, mid + branchA * 0.45);
    ctx.moveTo(-branchB, far + branchB * 0.4);
    ctx.lineTo(0, far);
    ctx.lineTo(branchB, far + branchB * 0.4);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBubble(ctx, bubble) {
  const { x, y, size, alpha, rimAlpha, highlightAlpha } = bubble;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${rimAlpha})`;
  ctx.lineWidth = Math.max(0.8, size * 0.06);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    x - size * 0.28,
    y - size * 0.3,
    Math.max(1.2, size * 0.22),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    x + size * 0.22,
    y + size * 0.18,
    Math.max(0.8, size * 0.1),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
  ctx.fill();
}

function drawSparkle(ctx, sparkle) {
  const twinkle = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(sparkle.phase));
  const alpha = sparkle.alpha * twinkle;
  const r = sparkle.size * (0.7 + 0.45 * twinkle);
  const d = r * 0.42;

  ctx.save();
  ctx.translate(sparkle.x, sparkle.y);
  ctx.rotate(sparkle.spin);
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, alpha + 0.15)})`;
  ctx.lineCap = "round";
  ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`;
  ctx.shadowBlur = Math.max(3, r * 2.2);
  ctx.lineWidth = Math.max(0.7, r * 0.22);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.5, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(-d, -d);
  ctx.lineTo(d, d);
  ctx.moveTo(d, -d);
  ctx.lineTo(-d, d);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.55, r * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFirefly(ctx, fly) {
  const pulse = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(fly.phase), 1.35);
  const a = fly.alpha * pulse;
  if (a < 0.03) return;
  const r = fly.size * (0.65 + 0.55 * pulse);
  const glow = `hsla(${fly.hue}, 100%, 62%, ${a})`;
  ctx.save();
  ctx.translate(fly.x, fly.y);
  ctx.shadowColor = glow;
  ctx.shadowBlur = Math.max(10, r * 10);
  ctx.fillStyle = `hsla(${fly.hue}, 100%, 68%, ${a * 0.45})`;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsla(${fly.hue}, 100%, 78%, ${Math.min(0.95, a + 0.12)})`;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(255, 252, 230, ${Math.min(0.96, a + 0.22)})`;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.45, r * 0.32), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function makeRainWalker() {
  return {
    x: 28,
    dir: 1,
    speed: 0.95,
    phase: 0,
  };
}

function drawBikeWheel(ctx, x, y, r, rot) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 0; i < 3; i += 1) {
    const a = rot + (i * Math.PI) / 1.5;
    ctx.moveTo(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22);
    ctx.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88);
  }
  ctx.stroke();
}

function drawScooterAndBanner(ctx, walker, groundY, bannerText) {
  const bob = Math.abs(Math.sin(walker.phase * 2)) * 0.28;
  const rot = walker.phase;
  const ink = "rgba(8, 8, 10, 0.92)";
  ctx.save();
  ctx.translate(walker.x, groundY - bob);
  ctx.scale(walker.dir, 1);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const rearX = -6.6;
  const frontX = 8.4;
  const wheelY = -2.9;
  const wheelR = 2.85;

  ctx.beginPath();
  ctx.moveTo(rearX + 1.4, -4.6);
  ctx.lineTo(5.4, -4.7);
  ctx.lineTo(6.6, -9.6);
  ctx.lineTo(5.2, -10.4);
  ctx.lineTo(4.4, -6.2);
  ctx.lineTo(-2.8, -6.4);
  ctx.quadraticCurveTo(-5.4, -6.8, -6.2, -4.8);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.moveTo(-5.8, -4.8);
  ctx.lineTo(6.2, -4.8);
  ctx.moveTo(5.8, -6.4);
  ctx.lineTo(7.4, -11.2);
  ctx.lineTo(9.2, -11.6);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(-1.4, -7.4, 3.4, 1.35, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-2.2, -7.6);
  ctx.quadraticCurveTo(-0.4, -13.2, 2.2, -14.6);
  ctx.lineTo(3.6, -13.8);
  ctx.quadraticCurveTo(1.2, -11.2, 0.2, -7.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2.6, -16.1, 2.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(1.6, -13.2);
  ctx.lineTo(7.6, -11.4);
  ctx.moveTo(-1.6, -7.2);
  ctx.lineTo(1.4, -5.2);
  ctx.stroke();

  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(rearX - 0.4, -5.4);
  ctx.lineTo(rearX - 3.6, -8.2);
  ctx.stroke();

  drawBikeWheel(ctx, rearX, wheelY, wheelR, rot);
  drawBikeWheel(ctx, frontX, wheelY, wheelR, rot);
  ctx.restore();

  const text = String(bannerText ?? "").trim() || " ";
  ctx.save();
  ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const bannerH = 16;
  const bannerW = Math.max(56, ctx.measureText(text).width + 22);
  const hitchX = walker.x - walker.dir * 12.5;
  const hitchY = groundY - 8.2 - bob;
  const t = walker.phase;
  const flow = -walker.dir;
  const attachX = hitchX + flow * 6;
  const steps = 14;

  const clothX = (u) => attachX + flow * bannerW * u;
  const clothTop = (u) =>
    hitchY - bannerH * 0.48 + Math.sin(t * 0.32 + u * 3.4) * (1.1 + u * 2.4);
  const clothBot = (u) =>
    hitchY + bannerH * 0.48 + Math.sin(t * 0.32 + u * 3.4 + 0.7) * (1 + u * 2.2);
  const clothMid = (u) => (clothTop(u) + clothBot(u)) / 2;

  ctx.strokeStyle = "rgba(8, 8, 10, 0.55)";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hitchX, hitchY);
  ctx.quadraticCurveTo(
    hitchX + flow * 4,
    hitchY + Math.sin(t) * 0.8,
    attachX,
    hitchY,
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(clothX(0), clothTop(0));
  for (let i = 1; i <= steps; i += 1) {
    const u = i / steps;
    ctx.lineTo(clothX(u), clothTop(u));
  }
  const tipX = clothX(1) + flow * 7;
  const tipY = hitchY + Math.sin(t * 0.32 + 3.6) * 2.6;
  ctx.quadraticCurveTo(tipX, tipY, clothX(1), clothBot(1));
  for (let i = steps - 1; i >= 0; i -= 1) {
    const u = i / steps;
    ctx.lineTo(clothX(u), clothBot(u));
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(attachX, hitchY, clothX(1), hitchY);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  grad.addColorStop(0.55, "rgba(236, 246, 255, 0.86)");
  grad.addColorStop(1, "rgba(219, 234, 254, 0.72)");
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.38)";
  ctx.lineWidth = 0.85;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.font = "600 11px 'Segoe UI', 'Noto Sans', ui-sans-serif, sans-serif";
  ctx.fillStyle = "rgba(30, 41, 59, 0.88)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = Array.from(text);
  const charWidths = chars.map((ch) => ctx.measureText(ch).width);
  const textW = Math.max(
    1,
    charWidths.reduce((sum, w) => sum + w, 0),
  );
  const uStart = 0.08;
  const uEnd = 0.9;
  let acc = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const cw = charWidths[i];
    const along = (acc + cw / 2) / textW;
    const fromHitch = uStart + along * (uEnd - uStart);
    const u = flow < 0 ? uStart + uEnd - fromHitch : fromHitch;
    const x = clothX(u);
    const y = clothMid(u);
    const u2 = Math.min(1, Math.max(0, u + (flow < 0 ? -0.04 : 0.04)));
    let ang = Math.atan2(clothMid(u2) - y, clothX(u2) - x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    acc += cw;
  }
  ctx.restore();
  ctx.restore();
}

function RainFallOverlay({ enabled = true, density = "medium" }) {
  const canvasRef = useRef(null);
  const { theme } = useTheme();
  const [effectKey, setEffectKey] = useState(() =>
    normalizeWeatherEffectKey(WEATHER_EFFECT_KEY),
  );

  useEffect(() => {
    setEffectKey(normalizeWeatherEffectKey(WEATHER_EFFECT_KEY));
  }, [WEATHER_EFFECT_KEY]);

  useEffect(() => {
    const emitChanged = (key) => {
      window.dispatchEvent(
        new CustomEvent(WEATHER_CHANGED_EVENT, { detail: { key } }),
      );
    };
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target) || !matchesWeatherHotkey(event)) return;
      event.preventDefault();
      setEffectKey((prev) => {
        const next = nextWeatherKey(prev);
        emitChanged(next);
        return next;
      });
    };
    const onRequest = (event) => {
      const next = normalizeWeatherEffectKey(event?.detail?.key);
      setEffectKey(next);
      emitChanged(next);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(WEATHER_CHANGE_EVENT, onRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(WEATHER_CHANGE_EVENT, onRequest);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled || effectKey === "off" || prefersReducedMotion()) {
      return undefined;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let raf = 0;
    let strikeTimer = 0;
    let particles = [];
    let leaves = [];
    let walker = makeRainWalker();
    let kind = activeKindFromKey(effectKey, "rain") || "rain";
    let width = 0;
    let height = 0;
    let dpr = 1;
    let flash = 0;
    let rumble = 0;
    let bolt = null;
    let boltLife = 0;
    let windBornAt = 0;
    let windDir = 1;
    let windStreaks = [];
    let nextStrikeAt = performance.now() + randomBetween(4500, 12000);
    let nextWindAt = performance.now() + randomBetween(6000, 16000);
    let nextCycleAt = performance.now() + WEATHER_CYCLE_MS;
    const dropsPerPx = DENSITY[density] ?? DENSITY.medium;
    const isDark = theme === "dark";
    const boltCore = isDark
      ? "rgba(255, 255, 255, 1)"
      : "rgba(248, 252, 255, 1)";
    const boltGlow = isDark
      ? "rgba(170, 210, 255, 0.85)"
      : "rgba(140, 180, 230, 0.75)";

    const rebuild = (nextKind, spawnFromEdge) => {
      kind = nextKind;
      const scale =
        nextKind === "snow"
          ? 0.52
          : nextKind === "bubbles"
            ? 0.38
            : nextKind === "sparkles"
              ? 0.7
              : nextKind === "fireflies"
                ? 0.48
                : 1;
      let count = Math.max(
        nextKind === "bubbles"
          ? 22
          : nextKind === "sparkles"
            ? 48
            : nextKind === "fireflies"
              ? 80
              : 36,
        Math.round(particleCount(width, height, dropsPerPx) * scale),
      );
      if (nextKind === "fireflies") {
        count = Math.max(80, Math.min(120, count));
      }
      const factory = particleFactory(nextKind);
      particles = Array.from({ length: count }, () => factory(width, height));
      const leafCount = Math.max(
        12,
        Math.min(28, Math.round((width * height) / 72000)),
      );
      leaves =
        nextKind === "rain"
          ? Array.from({ length: leafCount }, () =>
              makeFallingLeaf(width, height),
            )
          : [];
      walker.x = Math.min(width + 18, Math.max(-18, walker.x));
      if (spawnFromEdge && nextKind !== "fireflies") {
        particles.forEach((item) => {
          item.y =
            nextKind === "bubbles"
              ? height + randomBetween(8, height * 0.4)
              : -randomBetween(8, height * 0.35);
        });
      }
      bolt = null;
      boltLife = 0;
      windBornAt = 0;
      windStreaks = [];
      flash = 0;
      rumble = 0;
      nextStrikeAt = performance.now() + randomBetween(5000, 12000);
      nextWindAt = performance.now() + randomBetween(6000, 16000);
    };

    const spawnWind = (now) => {
      if (kind !== "rain") return;
      if (now - windBornAt < WIND_MS) {
        nextWindAt = windBornAt + WIND_MS + randomBetween(4000, 12000);
        return;
      }
      windDir = Math.random() < 0.5 ? -1 : 1;
      windBornAt = now;
      windStreaks = Array.from({ length: 28 }, () =>
        makeWindStreak(width, height, windDir),
      );
      nextWindAt = now + WIND_MS + randomBetween(5000, 18000);
    };

    const spawnStrike = (now) => {
      if (kind !== "rain") return;
      bolt = makeBolt(width, height);
      boltLife = 1;
      flash = randomBetween(0.22, 0.42);
      rumble = 0;
      const doubleFlash = Math.random() < 0.45;
      nextStrikeAt = now + randomBetween(7000, 16000);
      if (doubleFlash) {
        window.clearTimeout(strikeTimer);
        strikeTimer = window.setTimeout(
          () => {
            flash = Math.max(flash, randomBetween(0.28, 0.52));
            boltLife = 1;
            rumble = 0.18;
          },
          90 + Math.random() * 140,
        );
      } else {
        rumble = 0.14;
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild(kind, false);
    };

    const tickRain = (wind) => {
      ctx.lineCap = "round";
      const slantBoost = wind * 1.15;
      const lean = REST_LEAN + (windDir - REST_LEAN) * wind;
      for (let i = 0; i < particles.length; i += 1) {
        const drop = particles[i];
        const slant = drop.drift + slantBoost;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${drop.alpha})`;
        ctx.lineWidth = drop.lineWidth;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.len * slant * lean, drop.y + drop.len);
        ctx.stroke();
        drop.y += drop.speed * (1 + wind * 0.18);
        drop.x += drop.speed * slant * lean;
        if (drop.y > height + drop.len) {
          const next = makeDrop(width, height);
          next.x = Math.random() * width;
          next.y = -next.len;
          particles[i] = next;
        } else if (drop.x < -40) {
          const next = makeDrop(width, height);
          next.x = width + randomBetween(8, 36);
          next.y = Math.random() * height;
          particles[i] = next;
        } else if (drop.x > width + 40) {
          const next = makeDrop(width, height);
          next.x = -randomBetween(8, 36);
          next.y = Math.random() * height;
          particles[i] = next;
        }
      }
    };

    const tickLeaves = (wind) => {
      const lean = REST_LEAN + (windDir - REST_LEAN) * wind;
      for (let i = 0; i < leaves.length; i += 1) {
        const leaf = leaves[i];
        leaf.wobble += leaf.wobbleSpeed;
        leaf.spin += leaf.spinSpeed + Math.sin(leaf.wobble) * 0.012;
        leaf.y += leaf.speed * (1 + wind * 0.35);
        leaf.x +=
          Math.sin(leaf.wobble) * leaf.drift + leaf.speed * lean * (0.35 + wind);
        ctx.globalAlpha = 1;
        drawFallingLeaf(ctx, leaf);
        if (leaf.y > height + leaf.size * 2) {
          const next = makeFallingLeaf(width, height);
          next.x = Math.random() * width;
          next.y = -next.size * 2;
          leaves[i] = next;
        } else if (leaf.x < -40) {
          leaf.x = width + 20;
        } else if (leaf.x > width + 40) {
          leaf.x = -20;
        }
      }
    };

    const tickBubbles = () => {
      for (let i = 0; i < particles.length; i += 1) {
        const bubble = particles[i];
        bubble.wobble += bubble.wobbleSpeed;
        bubble.y -= bubble.speed;
        bubble.x += Math.sin(bubble.wobble) * bubble.drift;
        ctx.globalAlpha = 1;
        drawBubble(ctx, bubble);
        if (
          bubble.y < -bubble.size * 2 ||
          bubble.x < -40 ||
          bubble.x > width + 40
        ) {
          const next = makeBubble(width, height);
          next.x = Math.random() * width;
          next.y = height + next.size * 2 + randomBetween(0, 80);
          particles[i] = next;
        }
      }
    };

    const tickSparkles = () => {
      for (let i = 0; i < particles.length; i += 1) {
        const sparkle = particles[i];
        sparkle.phase += sparkle.twinkleSpeed;
        sparkle.spin += sparkle.spinSpeed;
        sparkle.wobble += sparkle.wobbleSpeed;
        sparkle.y += sparkle.speed;
        sparkle.x += Math.sin(sparkle.wobble) * sparkle.drift;
        ctx.globalAlpha = 1;
        drawSparkle(ctx, sparkle);
        if (
          sparkle.y > height + sparkle.size * 3 ||
          sparkle.x < -16 ||
          sparkle.x > width + 16
        ) {
          const next = makeSparkle(width, height);
          next.x = Math.random() * width;
          next.y = -next.size * 3;
          particles[i] = next;
        }
      }
      ctx.shadowBlur = 0;
    };

    const tickFireflies = () => {
      for (let i = 0; i < particles.length; i += 1) {
        const fly = particles[i];
        fly.phase += fly.blinkSpeed;
        fly.bob += fly.bobSpeed;
        fly.heading += fly.turn + Math.sin(fly.bob) * 0.012;
        fly.x += Math.cos(fly.heading) * fly.speed;
        fly.y +=
          Math.sin(fly.heading) * fly.speed * 0.72 + Math.sin(fly.bob) * 0.18;
        if (fly.x < -12) fly.x = width + 12;
        else if (fly.x > width + 12) fly.x = -12;
        if (fly.y < -12) fly.y = height + 12;
        else if (fly.y > height + 12) fly.y = -12;
        ctx.globalAlpha = 1;
        drawFirefly(ctx, fly);
      }
      ctx.shadowBlur = 0;
    };

    const tickSnow = () => {
      for (let i = 0; i < particles.length; i += 1) {
        const flake = particles[i];
        flake.wobble += flake.wobbleSpeed;
        flake.spin += flake.spinSpeed;
        flake.y += flake.speed;
        flake.x += Math.sin(flake.wobble) * flake.drift;
        ctx.globalAlpha = 1;
        drawFlake(ctx, flake);
        if (
          flake.y > height + flake.size * 2 ||
          flake.x < -24 ||
          flake.x > width + 24
        ) {
          const next = makeFlake(width, height);
          next.x = Math.random() * width;
          next.y = -next.size * 2;
          particles[i] = next;
        }
      }
      ctx.shadowBlur = 0;
    };

    const tick = (now) => {
      ctx.clearRect(0, 0, width, height);

      if (effectKey === "auto" && now >= nextCycleAt) {
        rebuild(nextAutoKind(kind), true);
        nextCycleAt = now + WEATHER_CYCLE_MS;
      }

      if (kind === "rain" && now >= nextStrikeAt) spawnStrike(now);
      if (kind === "rain" && now >= nextWindAt) spawnWind(now);
      const wind = kind === "rain" ? windEnvelope(now - windBornAt) : 0;

      if (flash > 0.01) {
        ctx.globalAlpha = flash;
        ctx.fillStyle = isDark
          ? "rgba(210, 228, 255, 1)"
          : "rgba(236, 244, 255, 1)";
        ctx.fillRect(0, 0, width, height);
        flash *= 0.86;
      } else {
        flash = 0;
      }

      if (rumble > 0.01) {
        ctx.globalAlpha = rumble * 0.35;
        ctx.fillStyle = isDark ? "rgba(40, 55, 80, 1)" : "rgba(70, 90, 120, 1)";
        ctx.fillRect(0, 0, width, height);
        rumble *= 0.94;
      } else {
        rumble = 0;
      }

      if (kind === "snow") tickSnow();
      else if (kind === "bubbles") tickBubbles();
      else if (kind === "sparkles") tickSparkles();
      else if (kind === "fireflies") tickFireflies();
      else {
        tickRain(wind);
        tickLeaves(wind);
      }

      if (kind === "rain" && bolt && boltLife > 0.04) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = Math.min(1, boltLife);
        ctx.strokeStyle = boltGlow;
        ctx.lineWidth = 6.5;
        ctx.shadowColor = boltGlow;
        ctx.shadowBlur = 18;
        strokePath(ctx, bolt.main);
        ctx.lineWidth = 3.2;
        bolt.branches.forEach((branch) => strokePath(ctx, branch));
        ctx.strokeStyle = boltCore;
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 8;
        strokePath(ctx, bolt.main);
        ctx.lineWidth = 1.1;
        bolt.branches.forEach((branch) => strokePath(ctx, branch));
        ctx.shadowBlur = 0;
        boltLife *= 0.82;
      } else if (kind !== "rain") {
        bolt = null;
        boltLife = 0;
        windBornAt = 0;
        windStreaks = [];
        leaves = [];
      }

      if (kind === "rain" && wind > 0.01) {
        drawWind(ctx, windStreaks, wind, windDir, isDark, width, height);
      }

      if (kind === "rain") {
        walker.phase += 0.28 * (1 + wind * 0.4);
        walker.x +=
          walker.dir * walker.speed * (1 + wind * 0.22) + windDir * wind * 0.55;
        if (walker.x > width + 28) walker.dir = -1;
        else if (walker.x < -28) walker.dir = 1;
        const groundY = height - 4;
        ctx.globalAlpha = 1;
        drawScooterAndBanner(
          ctx,
          walker,
          groundY,
          RAIN_SCOOTER_BANNER_TEXT,
        );
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      nextStrikeAt = performance.now() + randomBetween(2500, 8000);
      nextWindAt = performance.now() + randomBetween(4000, 12000);
      if (!raf) raf = requestAnimationFrame(tick);
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(strikeTimer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, density, theme, effectKey]);

  if (!enabled || effectKey === "off" || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <canvas ref={canvasRef} className="rain-fall-overlay" aria-hidden="true" />,
    document.body,
  );
}

export default memo(RainFallOverlay);
