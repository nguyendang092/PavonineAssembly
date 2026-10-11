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
  if (effectKey === "auto") return autoKind;
  return null;
}

function nextAutoKind(kind) {
  if (kind === "rain") return "snow";
  if (kind === "snow") return "bubbles";
  if (kind === "bubbles") return "sparkles";
  return "rain";
}

function particleFactory(kind) {
  if (kind === "snow") return makeFlake;
  if (kind === "bubbles") return makeBubble;
  if (kind === "sparkles") return makeSparkle;
  return makeDrop;
}

function particleCount(width, height, dropsPerPx) {
  return Math.max(
    70,
    Math.min(
      240,
      Math.round(((width * height) / 11000) * (dropsPerPx / 0.11)),
    ),
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
    let kind = activeKindFromKey(effectKey, "rain") || "rain";
    let width = 0;
    let height = 0;
    let dpr = 1;
    let flash = 0;
    let rumble = 0;
    let bolt = null;
    let boltLife = 0;
    let nextStrikeAt = performance.now() + randomBetween(4500, 12000);
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
              : 1;
      const count = Math.max(
        nextKind === "bubbles" ? 22 : nextKind === "sparkles" ? 48 : 36,
        Math.round(particleCount(width, height, dropsPerPx) * scale),
      );
      const factory = particleFactory(nextKind);
      particles = Array.from({ length: count }, () => factory(width, height));
      if (spawnFromEdge) {
        particles.forEach((item) => {
          item.y =
            nextKind === "bubbles"
              ? height + randomBetween(8, height * 0.4)
              : -randomBetween(8, height * 0.35);
        });
      }
      bolt = null;
      boltLife = 0;
      flash = 0;
      rumble = 0;
      nextStrikeAt = performance.now() + randomBetween(5000, 12000);
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
        strikeTimer = window.setTimeout(() => {
          flash = Math.max(flash, randomBetween(0.28, 0.52));
          boltLife = 1;
          rumble = 0.18;
        }, 90 + Math.random() * 140);
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

    const tickRain = () => {
      ctx.lineCap = "round";
      for (let i = 0; i < particles.length; i += 1) {
        const drop = particles[i];
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isDark
          ? `rgba(186, 220, 255, ${drop.alpha})`
          : `rgba(88, 132, 188, ${drop.alpha})`;
        ctx.lineWidth = drop.lineWidth;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.len * drop.drift, drop.y + drop.len);
        ctx.stroke();
        drop.y += drop.speed;
        drop.x -= drop.speed * drop.drift;
        if (drop.y > height + drop.len || drop.x < -24) {
          const next = makeDrop(width, height);
          next.x = Math.random() * width + 16;
          next.y = -next.len;
          particles[i] = next;
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
        ctx.fillStyle = isDark
          ? "rgba(40, 55, 80, 1)"
          : "rgba(70, 90, 120, 1)";
        ctx.fillRect(0, 0, width, height);
        rumble *= 0.94;
      } else {
        rumble = 0;
      }

      if (kind === "snow") tickSnow();
      else if (kind === "bubbles") tickBubbles();
      else if (kind === "sparkles") tickSparkles();
      else tickRain();

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
    <canvas
      ref={canvasRef}
      className="rain-fall-overlay"
      aria-hidden="true"
    />,
    document.body,
  );
}

export default memo(RainFallOverlay);
