# Ventilation App

Interactive ventilation flow modeling tool built with **React**, **Vite**, and **React Flow**.

The application allows users to build ventilation networks using drag-and-drop nodes
(sources, mixers, splits, halls, and sinks) and performs basic flow balance checks
and air change rate (ACH) calculations.

---

## Tech stack
- React
- Vite
- @xyflow/react (React Flow)

---

## Requirements

This application is intended to be run locally using Node.js.

### 1) Install Git (only required if cloning the repository)
- Download from: https://git-scm.com/download/win
- Install using **default options**
- After installation, close and reopen PowerShell

### 2) Install Node.js
- Download from: https://nodejs.org
- Install the **LTS version (18 or newer)**

You can verify installation with:
```bash
node --version
npm --version

Getting the project
Option A (recommended): Clone using Git
This is the most reliable method and avoids file or styling issues.
Open PowerShell
Navigate to the folder where you want the project (for example):
cd Documents
Clone the repository:
git clone https://github.com/lopezrpierre-ux/ventilationapp.v1.git
Enter the project folder:
cd ventilationapp.v1

Option B: Download ZIP (alternative)
If Git is not available:
Open the GitHub repository in a browser
Click Code → Download ZIP
Unzip the folder
Open PowerShell inside the unzipped folder
(the folder must contain package.json)
Install dependencies
From the project folder (where package.json is located):
npm install
Run the application (development mode)
npm run dev
Open the URL shown in the terminal (usually):
http://localhost:5173


