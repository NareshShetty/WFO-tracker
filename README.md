# Office Days

A static browser app that compares Google Maps Timeline visits with a configured office location to calculate attendance. Office days can also be added manually when Timeline data is unavailable or incomplete. Timeline data, office settings, manual office days, and holiday or leave selections stay in the current browser.

## Use

1. Open **Office settings** and enter the office coordinates and visit radius. The default office name is **Etamin Prestige**.
2. Optionally import one or more Google Maps Timeline JSON exports.
3. Select any calendar date and choose **Mark as office day** to record attendance manually. Timeline data is not required.
4. Review monthly attendance and attendance achieved to date. A visit spanning multiple dates counts on each date it covers.
5. Select dates in the calendar to mark holidays or leave. Weekends are excluded automatically.

Attendance is calculated as eligible office days divided by eligible workdays. Eligible workdays exclude weekends and dates marked as holidays or leave. Manually entered days are included in attendance calculations and in downloaded backups.

## Run locally

Open `index.html` in a browser, or serve this folder with a local static web server, for example:

```powershell
py -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploy with GitHub Pages

The `Deploy static app to GitHub Pages` workflow publishes the repository root whenever code is pushed to `main`.

1. In the repository, open **Settings → Pages**.
2. Set the build and deployment source to **GitHub Actions**.
3. Push to `main` or run the workflow from the **Actions** tab.
4. Open the site URL shown in the workflow deployment summary. For a project site it is usually `https://<owner>.github.io/<repository>/`.

Timeline export and local backup files should not be committed. They contain private location history; the provided `.gitignore` excludes common export and backup names.
