# AnatomyLens

Interactive 3D anatomy visualization for education and fitness.

## Overview

AnatomyLens is a web-based tool that allows users to explore human anatomy
through an interactive 3D model.

## Features

- 🦴 Interactive 3D anatomy model with hover highlighting
- 🔄 Smooth rotation and zoom controls
- 👁️ Layer visibility controls (bones, muscles, tendons, etc.)
- 🔍 Peel away layers to view deeper structures
- 📋 Detailed info panel with muscle origins, insertions, actions, and exercises

## Tech Stack

- **React 18** with TypeScript
- **Three.js** via react-three-fiber (R3F)
- **@react-three/drei** for 3D helpers
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Vite** for development and builds

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd anatomylens

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Other Comments

This repo contains all the public-facing materials for AnatomyLens. The body mesh and metadata are free for public use. All data for anatomy meshes were provided by the Z-Anatomy project under CC-BY-SA 4.0. 

## Acknowledgments

- Z-Anatomy project for open-source anatomical models
- BodyParts3D for the original dataset
- The react-three-fiber community
