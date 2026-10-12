# Office Days

A static browser app that compares Google Maps Timeline visits with a configured office location to calculate attendance. Timeline data, office settings, and holiday or leave selections stay in the current browser.

## Use

1. Open **Office settings** and enter the office coordinates and visit radius.
2. Import one or more Google Maps Timeline JSON exports.
3. Review monthly attendance and attendance achieved to date. A visit spanning multiple dates counts on each date it covers.
4. Select dates in the calendar to mark holidays or leave. Weekends are excluded automatically.

Attendance is calculated as eligible office days divided by eligible workdays. Eligible workdays exclude weekends and dates marked as holidays or leave.

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
