# Windows setup (PowerShell)

How to get Canopy running on Windows and start working on a feature.

## 1. Install Git and Node.js (one time)

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
```

Close and reopen PowerShell, then check both installed:

```powershell
git --version
node -v   # needs v22 or newer
```

## 2. Clone and run

```powershell
cd $HOME\Documents
git clone https://github.com/jtbinith/ApprenticeHack-Team4.git
cd ApprenticeHack-Team4
npm install
npm start
```

The Canopy window opens with demo data.

## 3. Work on a feature

Pick an issue from the [Team4-Kanban board](https://github.com/users/jtbinith/projects/4), then:

```powershell
git checkout main
git pull
git checkout -b feat/49-calendar      # feat/<issue>-<name>

# ...make changes...
npm run typecheck
npm run lint

git add .
git commit -m "Calendar month view (#49)"
git push -u origin feat/49-calendar
```

Open a pull request on GitHub and include `Closes #49` in the description. CI runs typecheck, lint and a build on every PR.

The first time you push, Git opens a browser window to sign in to GitHub. You need to be a repo collaborator to push; ask @jtbinith to add you if you aren't one yet.

## Troubleshooting

| Problem | Fix |
|---|---|
| `running scripts is disabled on this system` | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `node` or `git` not recognised | Close and reopen PowerShell after installing |
| `npm install` fails with an old Node | `winget upgrade OpenJS.NodeJS.LTS`, then reopen PowerShell |
| App shows old demo data | DevTools (`$env:CANOPY_DEVTOOLS=1; npm start`) → Application → IndexedDB → delete `canopy` → reload |
| Line-ending warnings (`LF will be replaced by CRLF`) | Safe to ignore, or run once: `git config --global core.autocrlf true` |

## Windows notes

- Use `npm start`, not `npm run start:linux`.
- `scripts/*.sh` (desktop launcher) are Linux only.
- `npm run make` doesn't produce a Windows installer yet; run the app with `npm start`.
