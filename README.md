# 🖌️ The Dutty Brush | Studio Landing Page

The central hub for **The Dutty Brush** studio. This is a high-performance, mobile-first landing page featuring a real-time project tracker ("The Forge") that syncs dynamically with the studio workbench.

## 🚀 Core Features

- **The Live Forge:** A dynamic project tracker that displays active Work-in-Progress (WIP) items.
- **Smart Filtering:** The landing page automatically hides projects that reach **100% completion**, keeping the focus on current activity.
- **Workbench Sync:** Integrated with `hobby.html` via a shared `data.json` architecture.
- **Adaptive UI:** Built with Tailwind CSS, featuring glassmorphism effects and desaturated imagery that pops into color on hover.
- **One-Touch Contact:** Integrated `mailto:` system with pre-formatted commission requirement templates.

## 🛠️ Technical Architecture

### Data Synchronization
The site uses an asynchronous `fetch` request to pull project data from `data.json`. The script is "Convention-Agnostic," meaning it supports both the legacy naming and the new Workbench naming conventions:

| Display Element | Workbench Field | Legacy Field |
| :--- | :--- | :--- |
| **Project Title** | `title` | `name` |
| **Progress %** | `progress` | `percentage` |
| **Category** | `category` | `type` |
| **Project Link** | `link` | `url` |
| **Thumbnail** | `thumbnail` | `image` |

### The "In-Flight" Logic
Projects are only rendered in the Forge if their progress value is **less than 100**. 
- **Badge:** The "Enter Workbench" button displays a red notification badge showing the total count of active projects.
- **Cards:** Each active project generates a clickable card leading directly to that project's specific URL or the general workbench.

## 📂 File Structure

- `index.html`: The main landing page and Forge engine.
- `hobby.html`: The studio workbench/management interface.
- `data.json`: The single source of truth for all project statuses.
- `avatar.jpg`: Studio branding icon.
- `baselair.png`: Integration icon for The Baselair.

## 🎨 Styling Constants

- **Background:** `radial-gradient` (#111111 to #050505)
- **Primary Accent:** `#ff3e3e` (Dutty Red)
- **Status Accent:** `#22c55e` (Glow Green)
- **Font:** Inter (Weight 400, 700, 900)

---
*Maintained by Gemini AI for The Dutty Brush Studio © 2026*
