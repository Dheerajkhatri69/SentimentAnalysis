"use client";
import { useEffect, useRef } from "react";
import { colors } from "@/lib/colors";

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class Circle {
  constructor(radius, x, y) {
    this._radius = radius;
    this.radius = radius;
    this.growthValue = 0;
    this.position = new Point(x, y);
  }

  draw(context, ease) {
    this.radius += ((this._radius + this.growthValue) - (this.radius)) * ease;
    context.moveTo(this.position.x, this.position.y);
    context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
  }

  addRadius(value) {
    this.growthValue = value;
  }

  get x() {
    return this.position.x;
  }

  set x(value) {
    this.position.x = value;
  }

  get y() {
    return this.position.y;
  }

  set y(value) {
    this.position.y = value;
  }
}

function normalize(value, min, max) {
  return (value - min) / (max - min);
}

function interpolate(value, min, max) {
  return min + (max - min) * value;
}

function map(value, min1, max1, min2, max2) {
  return interpolate(normalize(value, min1, max1), min2, max2);
}

function resizeCanvas(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export default function CanvasBackground() {
  const canvasRef = useRef(null);
  const parametersRef = useRef({
    size: 30,
    radius: 1,
    proximity: 125,
    growth: 60,
    ease: 0.075,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const parameters = parametersRef.current;
    let circles = [];
    let animationId = null;

    resizeCanvas(canvas);

    function build() {
      circles = [];
      const { size, radius } = parameters;
      const columns = Math.ceil(window.innerWidth / size) + 1;
      const rows = Math.ceil(window.innerHeight / size) + 1;
      const amount = Math.ceil(columns * rows);
      for (let i = 0; i < amount; i++) {
        const column = i % columns;
        const row = Math.floor(i / columns);
        circles.push(new Circle(radius, size * column, size * row));
      }
    }

    function mouseMoveHandler(event) {
      proximityHandler(event);
    }

    function touchMoveHandler(event) {
      proximityHandler(event.touches[0]);
    }

    function proximityHandler(event) {
      const { proximity, growth } = parameters;
      for (let c of circles) {
        let distance = Math.sqrt(
          Math.pow(c.x - event.clientX, 2) + Math.pow(c.y - event.clientY, 2)
        );
        let d = map(distance, c._radius, c._radius + proximity, growth, 0);
        if (d < 0) d = 0;
        c.addRadius(d);
      }
    }

    function animate() {
      // Fill canvas with background color
      context.fillStyle = "#5A9690";
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw particles that reveal the accent color
      context.save();
      context.beginPath();
      context.fillStyle = "#E0D9D9";
      for (let circle of circles) {
        circle.draw(context, parameters.ease);
      }
      context.fill();
      context.restore();
      animationId = requestAnimationFrame(animate);
    }

    function resizeHandler() {
      resizeCanvas(canvas);
      build();
    }

    build();
    window.addEventListener("resize", resizeHandler);
    window.addEventListener("mousemove", mouseMoveHandler);
    window.addEventListener("touchmove", touchMoveHandler);
    animate();

    return () => {
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("mousemove", mouseMoveHandler);
      window.removeEventListener("touchmove", touchMoveHandler);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="c"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}
