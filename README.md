# Multi-Elevator Dispatch System

A zero-dependency, real-time multi-elevator simulation and dispatch visualizer built with Vanilla JS, p5.js (Instance Mode), HTMX, and modern CSS.

![Favicon](favicon.png)

## Features
- **Nearest-Cabin Dispatch Algorithm**: Automatically routes external floor calls to the closest elevator using Manhattan distance logic translated from Java.
- **Dynamic p5.js 60 FPS Visual Engine**: Real-time rendering of elevator shafts, lerped cabin movements, sliding doors, and illuminated floor badges.
- **Zero-Scroll Telemetry HUD**: Monitor live direction (`UP`, `DOWN`, `IDLE`), target floor queues, and door states directly inside header pills and keypad cards.
- **Interactive In-Cab Keypads**: Direct destination selection for individual cabins (`[A]`, `[B]`, `[C]`, `[D]`).
- **Flexible Configuration**: Dynamically adjust the total number of floors (2-25) and elevators (1-10).

## Tech Stack
- **Frontend Core**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Animation & Visuals**: [p5.js](https://p5js.org/) (v1.x CDN in Instance Mode)
- **Dynamic Interactions**: [HTMX](https://htmx.org/) (v2.x CDN)

## Usage
Simply serve the directory with any static HTTP server or open `index.html` in your web browser.
