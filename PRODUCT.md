# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web application, including responsive mobile web. Operate-mode private workspace; no native app is implied.

## Users and jobs

Careerpath helps the owner organize job applications, plan OA/interview/deadline events, manage resume versions and compare resume evidence against a job description. The current request explicitly preserves these existing workflows, data, routes and account boundaries.

## Confirmed constraints

Application lists use 10-row pagination with search, filters, sorting and browser history. Ghosting after 30 days is a manual review, never an automatic status change. Events and dashboard reminders share ownership and application links; dashboard reminders require opening the app. Resume reviews are free and rule-based, with PDF/pasted-text sources and saved reports; no AI-provider calls are needed. PDFs remain private with bounded upload/extraction and short-lived downloads.

React/Vite/TypeScript frontend, Express/Prisma/PostgreSQL backend, Clerk authentication and private Vercel Blob hosting are existing project facts. Retain S3 compatibility only for legacy records until reviewed cutover. Never print secrets or resume contents, enable a paid service, delete source files or change production as a side effect of UI work.

## Current approved work

The user approved the full flat redesign and S3 migration preparation on 2026-11-02. Preserve features and application data; produce a synthetic preview, a read-only inventory and a free-tier capacity check before production migration or deployment. No email/push notifications, new AI service or unrelated AWS migration is included. Visual decisions live in DESIGN.md.
