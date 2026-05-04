# SINFIMAC Ecosystem - Advanced FM & Productivity Platform

![SINFIMAC Logo](/logo-final.png)

## Overview
SINFIMAC Ecosystem is a high-performance Facility Management (FM) and Productivity platform designed for field testing and operational control. It provides a robust, professional workflow for ticket management, financial tracking, and technician coordination.

## Key Features
- **Intelligent Ticketing**: 12-state operative flow with SLA tracking (72h standard).
- **Financial Control**: Real-time tracking of advances, material costs, and final liquidation.
- **Client & Branch Management**: Geo-distributed branch management for large institutions (e.g., Mibanco).
- **Technician Integration**: Competency-based assignment and technical report management.
- **Automated Documentation**: Online quotation editor (Excel-style) and PDF generation.
- **Security**: Role-based access control (Admin/Gestor) with middleware protection.

## Security & Architecture
- **Authentication**: Secured via Next.js Middleware with role persistence in cookies.
- **Data Persistence**: Leveraging local storage for high availability in field conditions (no internet required for basic operations).
- **Modern UI**: Built with Next.js 16, React 19, and Outfit typography for a premium, corporate aesthetic.

## Development

### Getting Started
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

## Maintenance
- **Vulnerability Checks**: Regularly audited for XSS and access control bypasses.
- **Clean Code Policy**: No debug logs or auxiliary scripts are included in production deployments.

---
© 2026 SINFIMAC. All rights reserved.
// Tue Apr 28 20:29:08 UTC 2026
# Build trigger
# SSO disabled
