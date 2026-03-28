# Parser Rule Update Plan (Next Session)

## Goal
Improve company and role extraction quality for Gmail + ICS interview invites, especially for recruiter-platform emails and noisy summaries.

## Updated Extraction Strategy

### Company Extraction (Priority Order)
1. ICS `ORGANIZER` email domain (preferred), with normalization map.
2. If sender is recruiter-platform domain, parse company from subject/body/signature phrases.
3. Subject patterns:
   - `with <Company>`
   - `at <Company>`
   - `for '<Company>'`
4. Signature/company lines in body.
5. Fallback sender domain (only if non-platform domain).
6. Else `Unknown Company`.

### Role Extraction (Priority Order)
1. Strong explicit patterns:
   - `for the post of <Role>`
   - `for the opportunity '<Role>'`
   - `role of <Role>`
   - `position of <Role>`
   - `Interview Schedule- <Role> -`
   - `Round X ... - <Role>`
2. ICS `SUMMARY` role-like chunk.
3. Subject role phrase with keyword scoring.
4. Normalize role text:
   - `.Net` -> `.NET Developer` (if standalone)
   - `Fullstack developer` -> `Full Stack Developer`
5. Else `Unknown Role`.

## Recruiter-Platform Domain Rules
Treat these as platform domains (do not directly map to company):
- `kekamail.com`
- `flocareer.com`
- `ripplehire.com`
- `smartrecruiters.com`
- `talent.win`

For platform domains, derive company from subject/body patterns instead.

## Domain -> Display Name Normalization
- `wipropari.com` -> `Wipro PARI`
- `travelodeal.net` -> `Travelodeal`
- `latentbridge.com` -> `LatentBridge`
- `equifax.com` -> `Equifax`
- `nonstopio.com` -> `NonStop io Technologies`

(Extend this map as more examples appear.)

## Noise and Garbage Filtering
Reject company/role candidates if:
- disclaimer/legal text
- very long warning lines
- generic values like `1`, `Online`, `Calendar`
- HTML/escaped boilerplate fragments

## Expected Output for Shared Samples

1. `no-reply@kekamail.com` (Wai mail)
- Company: `Wai Technologies Private Limited`
- Role: `Full Stack Developer`

2. FloCareer LTIMindtree mail
- Company: `LTIMindtree`
- Role: `.Net Fullstack Developer`

3. Ripplehire LTIMindtree mail
- Company: `LTIMindtree`
- Role: `Specialist - Software Engineering`

4. Latentbridge mail
- Company: `LatentBridge`
- Role: `.Net`

5. Travelodeal mail
- Company: `Travelodeal`
- Role: `.NET Developer` (or `.NET` normalized consistently)

## Data Quality Guardrails
- If company == role, retry extraction with alternate sources.
- Track parse source + confidence for both company and role.
- Keep fallback behavior deterministic and auditable.

## Next Implementation Tasks
1. Add platform-domain detector and domain normalization map.
2. Add strong role/company regex patterns from body+subject+ICS summary.
3. Add quality filter to block disclaimer/noise candidates.
4. Re-run full sync and compare before/after on problematic rows.
5. Keep a parser test fixture set using the shared real samples.
