import { useEffect, useRef } from "react";

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Star = {
      x: number;
      y: number;
      r: number;
      opacity: number;
      speed: number;
      phase: number;
      color: string;
      glow: number;
      layer: number;
    };

    type ShootingStar = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      length: number;
    };

    let animId: number;
    const stars: Star[] = [];
    const shootingStars: ShootingStar[] = [];

    const colors = [
      "255, 255, 255",
      "190, 220, 255",
      "160, 200, 255",
      "200, 170, 255",
      "255, 200, 180",
      "180, 255, 230",
    ];

    const seed = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars.length = 0;
      const count = Math.floor((canvas.width * canvas.height) / 3200);
      for (let i = 0; i < count; i++) {
        const layer = Math.random() < 0.08 ? 2 : Math.random() < 0.25 ? 1 : 0;
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r:
            layer === 2
              ? Math.random() * 2 + 1
              : layer === 1
                ? Math.random() * 1.2 + 0.4
                : Math.random() * 0.7 + 0.2,
          opacity:
            layer === 2 ? Math.random() * 0.4 + 0.5 : Math.random() * 0.5 + 0.1,
          speed: Math.random() * 0.02 + 0.005,
          phase: Math.random() * Math.PI * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          glow:
            layer === 2
              ? Math.random() * 8 + 3
              : layer === 1 && Math.random() > 0.6
                ? Math.random() * 4 + 2
                : 0,
          layer,
        });
      }
    };

    const spawnShootingStar = () => {
      const fromTop = Math.random() < 0.6;
      const x = fromTop ? Math.random() * canvas.width : canvas.width + 10;
      const y = fromTop ? -10 : Math.random() * canvas.height * 0.4;
      const angle = Math.PI * 0.2 + Math.random() * Math.PI * 0.35;
      const speed = 8 + Math.random() * 7;
      shootingStars.push({
        x,
        y,
        vx: -Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 35 + Math.random() * 35,
        length: 60 + Math.random() * 100,
      });
    };

    let t = 0;
    let frameCount = 0;
    let nextShoot = 180 + Math.random() * 350;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;
      frameCount++;

      for (const s of stars) {
        const twinkle = Math.sin(t * s.speed * 60 + s.phase);
        const op = s.opacity + twinkle * (s.layer === 2 ? 0.3 : 0.15);
        const finalOp = Math.max(0.03, Math.min(1, op));

        if (s.glow > 0) {
          ctx.shadowBlur = s.glow * (0.8 + twinkle * 0.2);
          ctx.shadowColor = `rgba(${s.color}, ${finalOp * 0.6})`;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${finalOp})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Shooting stars
      if (frameCount >= nextShoot) {
        spawnShootingStar();
        nextShoot = frameCount + 250 + Math.random() * 500;
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;

        const progress = ss.life / ss.maxLife;
        const alpha =
          progress < 0.1
            ? progress * 10
            : Math.max(0, 1 - (progress - 0.1) / 0.9);

        if (alpha <= 0 || ss.x < -150 || ss.y > canvas.height + 150) {
          shootingStars.splice(i, 1);
          continue;
        }

        const mag = Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy);
        const tailX = ss.x - (ss.vx / mag) * ss.length * alpha;
        const tailY = ss.y - (ss.vy / mag) * ss.length * alpha;

        const gradient = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        gradient.addColorStop(0.3, `rgba(190, 210, 255, ${alpha * 0.4})`);
        gradient.addColorStop(1, "rgba(190, 210, 255, 0)");

        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.8, 0, Math.PI * 2);
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(190, 210, 255, ${alpha})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(draw);
    };

    seed();
    draw();

    const onResize = () => seed();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
      style={{ opacity: 0.85 }}
    />
  );
}
