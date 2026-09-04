# AstroJob 🌌

AstroJob is a personal AI-assisted job discovery and matching system built around a real candidate profile instead of generic keyword matching.

## What it does

- Scores roles across **Fit**, **Desirability**, and **Priority**
- Classifies opportunities as **🌟 Core Match**, **🚀 Transferable Match**, **🪐 Stretch Match**, **☄️ Wild Card**, or **🕳️ Black Hole**
- Applies hard rules for salary, geography, posting freshness, language requirements, and core technical mismatches
- Organizes opportunities through a lightweight application board
- Explains why each role is or is not a match

## Search profile

### Roles
Customer-facing and customer-operations work broadly: Customer Success, Support, Customer Excellence, Customer Experience, Customer Operations, Client Services, Onboarding, Implementation, Account Management, Renewals, Service Delivery, Operations, Sales/Revenue Operations, Enablement, Quality, Process Improvement, Business Analysis, Program/Project Management, Team Leadership, and adjacent roles.

### Geography
- **Poland** — on-site, hybrid, or remote; highest priority
- **Greece** — on-site, hybrid, or remote
- **Moldova** — on-site, hybrid, or remote
- **Rest of EMEA** — remote only

### Salary rules
- **Poland:** undisclosed allowed; otherwise ≥ 10,000 PLN gross/month or ≥ 120,000 PLN gross/year
- **Greece:** undisclosed allowed; otherwise ≥ €2,400 gross/month or ≥ €28,000 gross/year
- **Moldova:** any salary
- **Rest of EMEA remote:** undisclosed allowed; otherwise ≥ €30,000 gross/year
- Conflicting monthly/annual salary values are allowed and flagged for review

### Languages
Romanian, Russian, English, and Greek are treated as working languages. Other languages are acceptable only when they are not hard requirements.

### Freshness
Jobs older than **21 days** are excluded unless renewed or reposted recently.

### Technical exclusions
Python or similar programming skills can appear as nice-to-haves, but roles where Python is a hard core requirement are rejected.

## Current stage

The current version is a static GitHub Pages-friendly front end with a configurable matching engine and sample data. **Live job ingestion is the next phase.**

## Roadmap
1. Connect live job sources
2. Normalize and deduplicate listings
3. Auto-score incoming jobs
4. Push worthwhile opportunities onto the board
5. Add alerts for high-priority matches
6. Learn from saved / applied / skipped decisions