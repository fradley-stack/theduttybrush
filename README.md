# The Dutty Brush | Studio Workbench

A bespoke, high-performance web archive for hobbyists and commission painters to document, track, and showcase miniature painting progress and color recipes.

## 🛠 Project Overview

**The Dutty Brush** is designed as a digital "Workbench"—a centralized hub that bridges the gap between a static portfolio and a dynamic project manager. It allows for real-time updates of project completion percentages, technique documentation, and asset management via a custom-built "Forge" editor.

### Core Objectives
* **Recipe Archiving:** Documentation of paint stages (Primer, Base, Layer, Highlight) for consistent army painting.
* **Progress Tracking:** Visual representation of project completion for both personal and commission work.
* **Minimalist Aesthetic:** A high-contrast, "glassmorphism" UI designed to let the miniature photography take center stage.
* **Serverless CMS:** Utilizing GitHub's API as a lightweight backend to manage data without the need for a dedicated database server.

---

## 🚀 Key Features

### 1. The Workbench (Hobby Archive)
* **Responsive Gallery:** A grid-based showcase of current and past projects.
* **Project Modals:** Deep-dive views for each project featuring a mobile-responsive carousel/slider and detailed paint recipes.
* **Status Tagging:** Instant visual distinction between *Personal* projects and *Commission* work.

### 2. The Forge (Admin Suite)
* **Live Editing:** A secure, prompt-authenticated editor built directly into the site.
* **GitHub Integration:** Real-time synchronization with `data.json` via the GitHub REST API.
* **Asset Management:** Support for multi-image projects via Cloudinary or external URL hosting.
* **Recipe Builder:** A dynamic interface to add, remove, and categorize paint steps on the fly.

---

## 💻 Tech Stack

* **Frontend:** HTML5, Tailwind CSS (via CDN for rapid styling).
* **Typography:** Google Fonts (Inter: 400, 700, 900).
* **Data Structure:** JSON (Flat-file architecture).
* **Backend Logic:** Vanilla JavaScript (ES6+) using Async/Await for API communication.
* **Hosting/Storage:** GitHub Pages.

---

## 📂 Repository Structure

* `index.html`: The main landing hub / portfolio entry.
* `hobby.html`: The Workbench application and gallery.
* `data.json`: The central database for all project details and recipes.
* `avatar.jpg`: Site branding and favicon.

---

## 🔒 Security & Privacy

* **Zero Sensitive Data:** This repository does not contain hardcoded API tokens or private keys.
* **Authentication:** The "Forge" editor requires a GitHub Personal Access Token (PAT) provided via user prompt at runtime, ensuring write-access is restricted to the repository owner only.
* **Environment:** All administrative actions are performed client-side and authenticated directly against the GitHub API.

---

## 🎨 Design Philosophy

The site follows a **Dark Studio** aesthetic:
* **Primary Palette:** `#050505` (Deep Black), `#ff3e3e` (Racing Red).
* **UI Elements:** 2% White transparency with 15px backdrop-blur for a "frosted glass" look.
* **Motion:** Smooth CSS transitions and Snap-X horizontal carousels for a tactile feel.

---

© 2026 The Dutty Brush. Built for the hobby.
