param(
  [ValidateSet('sprint2', 'sprint3', 'sprint4', 'sprint5')]
  [string]$Sprint = 'sprint2',
  [string]$Remote = 'origin',
  [switch]$DryRun,
  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

$BaseMap = @{
  sprint2 = 'main'
  sprint3 = 'sprint2'
  sprint4 = 'sprint3'
  sprint5 = 'sprint4'
}

$CommitMessages = @{
  sprint2 = 'feat(sprint2): implement F6-F10 operations, telemetry, realtime, alerts, automations & tracker'
  sprint3 = 'feat(sprint3): implement F11-F15 weather, calendar, care plans, recommendations & companions'
  sprint4 = 'feat(sprint4): implement F16-F20 journal, analytics, AI diagnosis/assistant & community'
  sprint5 = 'feat(sprint5): implement F21-F24, Three.js 3D visualizations, public pages, security hardening & CI'
}

$ExclusionRegex = '^(node_modules/|frontend/node_modules/|backend/node_modules/|dist/|frontend/dist/|build/|coverage/|\.sprint-checkpoints/)|(\.sqlite3?$|\.db(-journal|-wal|-shm)?$|\.log$|\.tmp$|^tmp_|^\.env($|\..*\.local$)|package-lock\.json$)'

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [switch]$AllowNonZero
  )
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & git @Args 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevPref
  }
  $textLines = @()
  foreach ($item in $output) {
    $textLines += $item.ToString()
  }
  if (-not $AllowNonZero -and $code -ne 0) {
    throw ("git {0} failed with exit code {1}:`n{2}" -f ($Args -join ' '), $code, ($textLines -join "`n"))
  }
  return [pscustomobject]@{
    ExitCode = $code
    Lines    = $textLines
    Text     = ($textLines -join "`n")
  }
}

function Parse-PorcelainPath {
  param([string]$Line)
  if ([string]::IsNullOrWhiteSpace($Line) -or $Line.Length -lt 4) {
    return $null
  }
  $pathPart = $Line.Substring(3).Trim()
  if ($pathPart -match '^"(.*)"$') {
    $pathPart = $Matches[1]
  }
  if ($pathPart -match ' -> (.+)$') {
    $pathPart = $Matches[1].Trim('"')
  }
  return ($pathPart -replace '\\', '/')
}

if (-not (Test-Path '.git')) {
  throw 'Must run scripts/git-deliver-sprints.ps1 from the SmartGarden repository root (.git missing).'
}

$BaseBranch = $BaseMap[$Sprint]
$null = Invoke-Git -Args @('rev-parse', '--verify', $BaseBranch)

$currentBranch = (Invoke-Git -Args @('rev-parse', '--abbrev-ref', 'HEAD')).Text.Trim()
$sprintBranchExistsRes = Invoke-Git -Args @('show-ref', '--verify', '--quiet', "refs/heads/$Sprint") -AllowNonZero
$sprintBranchExists = ($sprintBranchExistsRes.ExitCode -eq 0)

if ($sprintBranchExists -and $currentBranch -ne $Sprint) {
  throw ("Branch '{0}' already exists while HEAD is on '{1}'. Checkout '{0}' first or inspect history rather than overwriting it." -f $Sprint, $currentBranch)
}

Write-Output ("[Delivery] Target sprint: {0} (base={1}, current={2}, remote={3}, dryRun={4})" -f $Sprint, $BaseBranch, $currentBranch, $Remote, $DryRun.IsPresent)

if (-not $sprintBranchExists) {
  if ($DryRun) {
    Write-Output ("[DRY-RUN] Would create & checkout branch: git checkout -b {0} {1}" -f $Sprint, $BaseBranch)
  } else {
    $null = Invoke-Git -Args @('checkout', '-b', $Sprint, $BaseBranch)
    Write-Output ("[Delivery] Created and checked out branch '{0}' from '{1}'." -f $Sprint, $BaseBranch)
  }
}

# Commit 1 (sprint2 only): pre-Sprint-2 Document/*.md + vercel.json updates
$preSprint2Paths = @()
if ($Sprint -eq 'sprint2') {
  $docStatus = Invoke-Git -Args @('status', '--porcelain', '--', 'Document/', 'vercel.json')
  foreach ($line in $docStatus.Lines) {
    $p = Parse-PorcelainPath -Line $line
    if ($p) { $preSprint2Paths += $p }
  }

  if ($preSprint2Paths.Count -gt 0) {
    if ($DryRun) {
      Write-Output ("[DRY-RUN] Commit 1 (pre-sprint2 docs & vercel.json, {0} files):" -f $preSprint2Paths.Count)
      foreach ($p in $preSprint2Paths) { Write-Output ("  - {0}" -f $p) }
    } else {
      $null = Invoke-Git -Args @('reset')
      $null = Invoke-Git -Args (@('add', '--') + $preSprint2Paths)
      $cachedCheck = Invoke-Git -Args @('diff', '--cached', '--quiet') -AllowNonZero
      if ($cachedCheck.ExitCode -eq 1) {
        $null = Invoke-Git -Args @('commit', '-m', 'docs(specs): commit pre-sprint2 Document/*.md and vercel.json updates')
        Write-Output ("[Delivery] Committed Commit 1 ({0} pre-Sprint-2 files)." -f $preSprint2Paths.Count)
      }
    }
  } else {
    Write-Output '[Delivery] No uncommitted pre-Sprint-2 Document/*.md or vercel.json changes found (already committed or clean).'
  }
}

# Commit 2 (or single commit for sprint3-sprint5): sprint deliverables
$allStatus = Invoke-Git -Args @('status', '--porcelain', '-uall')
$remainingPaths = @()
foreach ($line in $allStatus.Lines) {
  $p = Parse-PorcelainPath -Line $line
  if (-not $p) { continue }
  if ($Sprint -eq 'sprint2' -and $DryRun -and ($preSprint2Paths -contains $p)) { continue }
  if ($p -match $ExclusionRegex) {
    throw ("Excluded runtime/artifact path detected in working tree status: {0}" -f $p)
  }
  $remainingPaths += $p
}

if ($DryRun) {
  Write-Output ("[DRY-RUN] Sprint commit '{0}' ({1} files):" -f $CommitMessages[$Sprint], $remainingPaths.Count)
  foreach ($p in $remainingPaths) { Write-Output ("  - {0}" -f $p) }
  if (-not $SkipPush) {
    Write-Output ("[DRY-RUN] Would push: git push -u {0} {1} (NEVER merging into main)" -f $Remote, $Sprint)
  }
  exit 0
}

if ($remainingPaths.Count -gt 0) {
  $null = Invoke-Git -Args @('reset')
  $null = Invoke-Git -Args @('add', '-A')
  $staged = (Invoke-Git -Args @('diff', '--cached', '--name-only')).Lines
  $badStaged = @($staged | Where-Object { $_ -match $ExclusionRegex })
  if ($badStaged.Count -gt 0) {
    $null = Invoke-Git -Args @('reset')
    throw ("Refusing commit: excluded paths were staged: {0}" -f ($badStaged -join ', '))
  }
  $cachedCheck2 = Invoke-Git -Args @('diff', '--cached', '--quiet') -AllowNonZero
  if ($cachedCheck2.ExitCode -eq 1) {
    $null = Invoke-Git -Args @('commit', '-m', $CommitMessages[$Sprint])
    Write-Output ("[Delivery] Committed '{0}' ({1} files)." -f $CommitMessages[$Sprint], $staged.Count)
  } else {
    Write-Output '[Delivery] No staged changes for sprint commit.'
  }
} else {
  Write-Output '[Delivery] Working tree clean; no sprint commit needed.'
}

if (-not $SkipPush) {
  $null = Invoke-Git -Args @('push', '-u', $Remote, $Sprint)
  Write-Output ("[Delivery] Pushed branch '{0}' to '{1}' (main left untouched)." -f $Sprint, $Remote)
}

Write-Output '--- Recent commits ---'
Write-Output (Invoke-Git -Args @('log', '-n', '3', '--oneline')).Text
Write-Output '--- Working tree status ---'
Write-Output (Invoke-Git -Args @('status', '--short')).Text
